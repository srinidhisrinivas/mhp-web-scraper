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
				
				await page.waitForSelector("table[width='100%'][border='0']",{timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table[width='100%'][border='0']",false);
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

		let mainTableData = await this.getTableDataBySelector(page, "table[width='100%'][border='0']",false);
		mainTableData = mainTableData[0].map(e => e.trim());
		mainTableData = mainTableData.filter(e => e !== '');

		let baseOwnerName = mainTableData[mainTableData.indexOf('Owner Name') + 1];
		console.log(baseOwnerName);

		let scrapedInfo = [undefined, undefined, undefined, baseOwnerName, undefined, undefined, undefined, undefined, undefined, undefined, undefined]; 

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("div.menu > ul.level1 > li > a");
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Sales History')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("table[id*=dataTbl]", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
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
			let conveyanceTableData = await this.getTableDataBySelector(page, "table[id*=dataTbl] tr", false);
			conveyanceTableData = conveyanceTableData[0];
			
			let transferAmount = '', transferDate = '';
			if(conveyanceTableData !== undefined) {
				transferAmount = conveyanceTableData[5];
				transferDate = conveyanceTableData[0];
			}	

			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
			else transferAmount = undefined;

			console.log(transferAmount);
			console.log(transferDate);

			scrapedInfo[CONFIG.DEV_CONFIG.DATE_IDX] = transferDate;
			scrapedInfo[CONFIG.DEV_CONFIG.PRICE_IDX] = transferAmount;
		}

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("div.menu > ul.level1 > li > a");
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Tax Charges')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("table[width='100%'][border='0']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit tax charges. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach tax info. Giving up.');
			
		} else {
			let conveyanceTableData = await this.getTableDataBySelector(page, "table[width='100%'][border='0']",false);
			conveyanceTableData = conveyanceTableData[1].map(e => e.trim());
			conveyanceTableData = conveyanceTableData.filter(e => e !== '');
			let addressLine = conveyanceTableData[4];
			addressLine = addressLine.split('\n');
			let taxName = addressLine.shift();
			let taxAddress = addressLine.slice(addressLine.length - 2).join(' ');
			console.log(taxName);
			console.log(taxAddress);
			
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_OWNER_IDX] = taxName;
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_ADDRESS_IDX] = taxAddress;
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
				await page.type("input#MainContent_txtParcelNum", parcelID);
				await page.evaluate(() => {
					document.querySelector("input#MainContent_cmdSearch").click();
				});
				await page.waitForSelector("table[id*=dataTbl]", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				await page.waitForSelector("table[id*=dataTbl] > tbody > tr > td > a", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.evaluate(() => {
					document.querySelector("table[id*=dataTbl] > tbody > tr > td > a").click();
				});
				await page.waitFor(200);
				await page.waitForSelector("table[width='100%'][border='0']",{timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table[width='100%'][border='0']",false);
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
