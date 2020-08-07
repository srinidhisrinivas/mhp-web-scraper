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
				await page.waitForSelector("input#ContentPlaceHolder1_btnDisclaimerAccept", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);
				let ackButton = await page.$("input#ContentPlaceHolder1_btnDisclaimerAccept");
				await ackButton.click();
				await page.waitFor(200);
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){
				// console.log(e);
				try{
					await page.waitForSelector("table#ContentPlaceHolder1_Base_fvDataMailingAddress", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
					const ownerTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataMailingAddress > tbody > tr > td > table.formview > tbody > tr",false);
					
					if(ownerTableData.length < 1){
						throw "Owner Table Not Found";
					}
				}
				catch(e){
					// console.log(e);
					console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
					continue;
				}
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

		let parcelInfoTable = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataProfile > tbody > tr > td > table.formview > tbody > tr",false)
		parcelInfoTable = parcelInfoTable.map(row => row[0].trim());
		let baseOwnerName = parcelInfoTable[1];

		let taxTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataMailingAddress > tbody > tr > td > table.formview > tbody > tr",false);
		taxTableData = taxTableData.map(row => row[0].trim());

		let taxName = taxTableData.slice(0, taxTableData.length - 2).join(' ');
		console.log(taxName);
		let taxAddress = taxTableData.slice(taxTableData.length - 2).join(' ');
		console.log(taxAddress);
		await page.waitFor(200);

		let sideMenu = await page.$$("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a");
		let transferTag, salePrice, saleDate;
		for(let i = 0; i < sideMenu.length; i++){
			handle = sideMenu[i];
			let prop = await handle.getProperty('innerText');
			let propJSON = await prop.jsonValue();
			if(propJSON === 'Sales') transferTag = handle;
		}

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await transferTag.click();
				await page.waitForSelector("table[id='ContentPlaceHolder1_Sales_gvDataSales']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit transfers. Attempt #' + visitAttemptCount);
				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach transfers. Giving up.');			
			salePrice = 0;
			saleDate = undefined;
		} else {
			let transferTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Sales_gvDataSales > tbody > tr",false);
			transferTableData = transferTableData.filter(row => row.length > 0);
			if(transferTableData.length > 0 && transferTableData[0].length > 1){
				let latestSaleData = transferTableData[0];

				salePrice = parseInt(latestSaleData[1].replace(/[,\$]/g, ''));
				saleDate = DateHandler.formatDate(new Date(latestSaleData[0]));	
			} else {
				salePrice = undefined;
				saleDate = undefined;
			}
			
		}
		if(isNaN(salePrice)) salePrice = undefined;
		console.log(salePrice);
		console.log(saleDate);
		console.log('\n');


		let scrapedInfo = [undefined, saleDate, salePrice, baseOwnerName, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 
		
		
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
		

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit transfers. Attempt #' + visitAttemptCount);
				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach transfers. Giving up.');
			let remainingLinks = hyperlinks.slice(i);
			return {
				code: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				remaining_links: remainingLinks,
				scraped_information: []
			};
		}
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(auditorURL);
				await page.waitForSelector("input#ContentPlaceHolder1_btnDisclaimerAccept", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);
				let ackButton = await page.$("input#ContentPlaceHolder1_btnDisclaimerAccept");
				await ackButton.click();
				await page.waitFor(200);
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){
				// console.log(e);
				try{
					await page.waitForSelector("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a");
					let sideMenu = await page.$$("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a");
					let transferTag;
					for(let i = 0; i < sideMenu.length; i++){
						handle = sideMenu[i];
						let prop = await handle.getProperty('innerText');
						let propJSON = await prop.jsonValue();
						if(propJSON === 'Parcel') transferTag = handle;
					}
					await transferTag.click();
					await page.waitForSelector("input#ContentPlaceHolder1_Parcel_tbParcelNumber");
					await page.click('input#ContentPlaceHolder1_Parcel_tbParcelNumber', {clickCount: 3});					
					await page.type('input#ContentPlaceHolder1_Parcel_tbParcelNumber', parcelID);
					const searchButton = await page.$('input#ContentPlaceHolder1_Parcel_btnSearchParcel');
					await searchButton.click();
					await page.waitFor(200);
					await page.waitForSelector("table#ContentPlaceHolder1_gvSearchResults", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
					const parcelURL = await page.$("table#ContentPlaceHolder1_gvSearchResults > tbody > tr > td > a");
					await parcelURL.click();
					page.waitFor(200);
					
					await page.waitForSelector("table#ContentPlaceHolder1_Base_fvDataMailingAddress", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
					const ownerTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataMailingAddress > tbody > tr > td > table.formview > tbody > tr",false);
					
					if(ownerTableData.length < 1){
						throw "Owner Table Not Found";
					}
					
				}
				catch(e){
					console.log(e);
					console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);
					continue;
				}
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
