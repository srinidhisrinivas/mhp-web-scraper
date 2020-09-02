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
					info += delimiter + ' ' + row[row.length - 1];
				} else {
					inTargetHeader = false;
					break;
				}
			} 
			else if(rowHeader === header){
				inTargetHeader = true;
				info += row[row.length-1];
			} 
		}
		return info;
	}
	this.getInfoFromTableByColumnHeader = async function(table, header, rowNum){
		let headers = table.shift();
		// console.log(headers);
		// console.log(header);
		let colIndex = headers.indexOf(header);
		if(colIndex > 0){
			return table[rowNum][colIndex];
		} else {
			return 'ERR'
		}
	}


	this.scrapeByPropertyURL = async function(page, propertyURL){
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(propertyURL);
				
				await page.waitForSelector("table#maintable", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table#maintable",false);
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
		

		// const parcelIDString = (await (await (await page.$('.DataletHeaderTopLeft')).getProperty('innerText')).jsonValue());
		// const parcelID = parcelIDString.substring(parcelIDString.indexOf(':')+2);

		let headTableData = await this.getTableDataBySelector(page, "table#headtable tr", false);
		let baseOwnerName = headTableData[0][0];
		console.log(baseOwnerName);

		let ownerTableData = await this.getTableDataBySelector(page, "table#maintable tr",false);
		ownerTableData = ownerTableData.filter(row => row.length >= 2);
		ownerTableData = ownerTableData.map(row => [row[0], row[2]]);
		ownerTableData = ownerTableData.filter(row => row.some(e => e !== undefined && e.length > 0));

		
		ownerTableData.pop();
		if(!isNaN(ownerTableData[ownerTableData.length - 1][0])) ownerTableData.pop();
		console.log(ownerTableData);

		let ownerData = ownerTableData.map(row => row[0]);
		let mailingData = ownerTableData.map(row => row[1]);

		let ownerNames = ownerData[0];
		console.log(ownerNames);
		let ownerAddress = ownerData.slice(1).join(' ');
		console.log(ownerAddress);

		let taxName = mailingData[0];
		console.log(taxName);
		let taxAddress = mailingData.slice(1).join(' ');
		console.log(taxAddress);


		let scrapedInfo = [undefined, undefined, undefined, baseOwnerName, ownerNames, ownerAddress, taxName, taxAddress, undefined, undefined, undefined]; 
		
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("ul.ktsUL > li.ktsLI > a");
				// console.log(sideMenu);
				//console.log(sideMenu);
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Sales History')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("table#maintable", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
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
			console.log('Failed to reach sales. Giving up.');
			
		} else {
			let conveyanceTableData = await this.getTableDataBySelector(page, "table#maintable tr", false);
			conveyanceTableData.shift();
			conveyanceTableData = conveyanceTableData.shift();
			let latestDateIndex = 0;
			
			let transferAmount = '', transferDate = '';
			if(conveyanceTableData !== undefined) {
				transferAmount = conveyanceTableData[6];
				transferDate = conveyanceTableData[2];
			}	

			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(DateHandler.incrementDate(new Date(transferDate)));
			else transferAmount = undefined;

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
		parcelID = parcelID.replace(/[-.]/g,'');
		let prefixLength = 12 - parcelID.length;
		if(prefixLength >= 0) parcelID = "0".repeat(prefixLength) + parcelID;

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(auditorURL);
				await page.type("input[name='quantity']", parcelID);
				await page.evaluate(() => {
					document.querySelector("input.nicerbutton").click();
				});
				await page.waitForSelector("table.s-results", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				await page.waitForSelector("table.s-results td[align='right'] > a", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.evaluate(() => {
					document.querySelector("table.s-results td[align='right'] > a").click();
				});
				await page.waitFor(200);
				await page.waitForSelector("table#maintable",{timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				const ownerTableData = await this.getTableDataBySelector(page, "table#maintable",false);
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

		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL);
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}


module.exports = Scraper

function infoValidator(info, processedInformation){
	let valid = false;
	if(info.transfer < info.value && info.transfer > 0) valid = true;
	if(processedInformation.some(e => e.owner === info.owner)) valid = false;	
	return valid;
	
}	
async function run(){
	const browser = await puppeteer.launch({headless: false, slowMo: 5});
	const page = await browser.newPage();
	const scrape = new Scraper();
	let allHyperlinks = await scrape.getParcelIDHyperlinksForDate(page);
	let processedInformation = await scrape.processHyperLinks(page, allHyperlinks, infoValidator);
}

// run();
