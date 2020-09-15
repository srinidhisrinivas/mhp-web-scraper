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
			    const columns = row.querySelectorAll('td, th');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td, th');
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
			
				await page.waitForSelector("table.w-100", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
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

		

		let allTableData = await this.getTableDataBySelector(page, "table.w-100 tr", false);
		let ownerTableData = allTableData.filter(row => row.includes('Current Owner'))[0];
		let baseOwnerName = ownerTableData[ownerTableData.indexOf('Current Owner') + 1];
		console.log(baseOwnerName);

		// let amtTableData = allTableData.filter(row => row.includes('Last Sale Amount'))[0];
		// let transferAmount = amtTableData[amtTableData.indexOf('Last Sale Amount') + 1];

		// let dateTableData = allTableData.filter(row => row.includes('Last Sale Date'))[0];
		// let transferDate = dateTableData[dateTableData.indexOf('Last Sale Date') + 1];

		// if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		// else transferAmount = undefined;
		// if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		// else transferAmount = undefined;

		// console.log(transferAmount);
		// console.log(transferDate);

		let scrapedInfo = [undefined, undefined, undefined, baseOwnerName, undefined, undefined, undefined, undefined, undefined, undefined, undefined]; 

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.click("a#ctl00_ContentPlaceHolderMainContent_lbTaxInfo");
				await page.waitFor(200);
				await page.waitForSelector("div#ctl00_ContentPlaceHolderMainContent_panTaxInfo", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit tax info. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach tax info. Giving up.');
			
		} else {
			let taxInfoHandle = await page.$('div#ctl00_ContentPlaceHolderMainContent_panTaxInfo');
			prop = await taxInfoHandle.getProperty('innerText');
			let taxInfo = await prop.jsonValue();

			taxInfo = taxInfo.split('\n');

			taxInfo = taxInfo.slice(taxInfo.indexOf('Tax Mailing Address') + 1, taxInfo.indexOf('Tax Info'));


			let taxName = taxInfo.shift();
			let taxAddress = taxInfo.join(' ');
			
			console.log(taxName);
			console.log(taxAddress);

			scrapedInfo[CONFIG.DEV_CONFIG.TAX_OWNER_IDX] = taxName;
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_ADDRESS_IDX] = taxAddress;
		}

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.click("a#ctl00_ContentPlaceHolderMainContent_lbSalesHistory");
				await page.waitFor(200);
				await page.waitForSelector("table.w-100.table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit tax info. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach tax info. Giving up.');
			
		} else {
			let salesTableData = await this.getTableDataBySelector(page, 'table.w-100.table tr', false);
			salesTableData.shift();
			let dates = salesTableData.map(row => new Date(row[0]));
			let maxDateIdx = 0;
			for(let i = 1; i < dates.length; i++){
				let currDate = dates[i];
				if(currDate >= dates[maxDateIdx]){
					maxDateIdx = i;
				}
			}
			let latestSaleData = salesTableData[maxDateIdx];
			
			let transferAmount = '', transferDate = '';
			if(latestSaleData !== undefined){
				transferAmount = latestSaleData[3];
				transferDate = latestSaleData[0];
			}
			
			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
			else transferAmount = undefined;

			console.log(transferAmount);
			console.log(transferDate);
			

			scrapedInfo[CONFIG.DEV_CONFIG.PRICE_IDX] = transferAmount;
			scrapedInfo[CONFIG.DEV_CONFIG.DATE_IDX] = transferDate;
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
				
				await page.waitForSelector("input#ctl00_ContentPlaceHolderMainContent_txtParcelID");
				await page.click('input#ctl00_ContentPlaceHolderMainContent_txtParcelID', {clickCount: 3});					
				await page.type('input#ctl00_ContentPlaceHolderMainContent_txtParcelID', parcelID);
				await page.waitFor(200);

				const searchButton = await page.$('input#ctl00_ContentPlaceHolderMainContent_btnParcel');
				await searchButton.click();

				await page.waitFor(200);
				await page.waitForSelector("table.w-100", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
			
			} catch(e){
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
