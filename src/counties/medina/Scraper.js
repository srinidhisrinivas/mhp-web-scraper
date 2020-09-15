const InfoParser = require('../../InfoParser.js');
const puppeteer = require('puppeteer');
const ConfigReader = require('../../ConfigReader.js');
const ErrorLogger = require("../../ErrorLogger.js");
const DateHandler = require("../../DateHandler.js");

const ERROR_LOGGER = new ErrorLogger('delaware');
const CONFIG = new ConfigReader('delaware');


let Scraper = function(){
	this.getTableDataBySelector = async function(page, selector, html){
		if(html){
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td');
			    const datum = Array.from(columns, column => column.innerText);
			    return datum;
				  });

			});
		}

		
	}

	this.getInfoFromTableByRowHeader = async function(table, header, delimiter){
		let inTargetHeader = false;
		let info = '';
		for(let i = 0; i < table.length; i++){
			let row = table[i];
			let rowHeader = row[0].trim();
			
			if(inTargetHeader){
				if(rowHeader === ''){
					if(!row[row.length - 1].includes("LIEN") && !row[row.length - 1].includes("SOLD")) info += delimiter + ' ' + row[row.length - 1];
				} else {
					inTargetHeader = false;
					break;
				}
			} 
			else if(rowHeader.includes(header)){
				inTargetHeader = true;
				info += row[row.length-1];
			} 
		}
		
		return info;
	}
	this.getInfoFromTableByColumnHeader = async function(table, header, rowNum){
		let headers = table[0];
		// console.log(headers);
		// console.log(header);
		let colIndex = headers.indexOf(header);

		if(colIndex >= 0){
			return table[rowNum + 1][colIndex];
		} else {
			return 'ERR'
		}
	}


	this.scrapeByPropertyURL = async function(page, propertyURL, parcelID){
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		// console.log('Receive call to property with URL: '+propertyURL);
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			
			try{
				await page.goto(propertyURL);
				await page.waitForSelector("table.table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table.table tr",false);
				
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
				continue;
			}
		
			
			break;	
		}

		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + propertyURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		let ownerTableData = await this.getTableDataBySelector(page, "table.table tr",false);
		let ownerData = ownerTableData.slice(1, 4);
		ownerData = ownerData.map(row => row[0]);

		let ownerNames = ownerData[0];
		console.log(ownerNames);
		let scrapedInfo = [undefined, undefined, undefined, ownerNames, undefined, undefined, undefined, undefined, undefined, undefined, undefined]; 

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("p.links > a");
				//console.log(sideMenu);
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Tax Bill')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit tax bill. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach tax bill. Giving up.');
			
		} else {
			let taxTable = await this.getTableDataBySelector(page, "table tr", false);
			taxTable = taxTable.slice(0,3);
			let taxName = taxTable[0][1];
			let taxAddress = taxTable[2].join(' ');
			console.log(taxName);
			console.log(taxAddress);
			
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_OWNER_IDX] = taxName;
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_ADDRESS_IDX] = taxAddress;
		}
		await page.goto(propertyURL);
		await page.waitForSelector("p.links > a");
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("p.links > a");
				//console.log(sideMenu);
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Transfers')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit transfers. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach transfers. Giving up.');
			
		} else {
			let transferTableData = await this.getTableDataBySelector(page, "table tr", false);
			transferTableData.shift();
			
			let dates = transferTableData.map(row => new Date(row[0].split('\n')[0]));
			let maxDateIdx = 0;
			for(let i = 1; i < dates.length; i++){
				let currDate = dates[i];
				if(currDate >= dates[maxDateIdx]){
					maxDateIdx = i;
				}
			}

			let latestTransferData = transferTableData[maxDateIdx];
			let transferDate = '', transferAmount = '';
			if(latestTransferData !== undefined){
				
				transferDate = latestTransferData[0].split('\n')[0];

				transferAmount = latestTransferData[latestTransferData.length - 1].split('\n')[0];
			}
			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(DateHandler.incrementDate(new Date(transferDate)));
			else transferDate = undefined;

			console.log(transferAmount);
			console.log(transferDate);

			scrapedInfo[CONFIG.DEV_CONFIG.DATE_IDX] = transferDate;
			scrapedInfo[CONFIG.DEV_CONFIG.PRICE_IDX] = transferAmount;
		}
				
		console.log('\n');

		return {
			scraped_information: scrapedInfo,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

	this.scrapeByAuditorURL = async function(page, auditorURL, parcelID){
		if(auditorURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		
		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);

				await page.waitForSelector("input#parcel");
				await page.click('input#parcel', {clickCount: 3});					
				await page.type('input#parcel', parcelID);
				await page.waitFor(200);

				// const searchButton = await page.$("input[type='submit']");
				// await searchButton.click();

				// await page.evaluate(() => {
				// 	document.querySelector("input[value='Search']").click();
				// });
				await page.keyboard.press('Enter');
				
				await page.waitForSelector('table.results a', {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);

				await page.click("table.results a");
				await page.waitFor(200);

				await page.waitForSelector("table.table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				
				const ownerTableData = await this.getTableDataBySelector(page, "table.table tr",false);
				
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
				
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);
				continue;
			}
		
			
			break;	
		}

		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + auditorURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		
		let propertyURL = page.url();
		// console.log('Making a call to property');
		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL, parcelID);
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}


module.exports = Scraper;


// run();
