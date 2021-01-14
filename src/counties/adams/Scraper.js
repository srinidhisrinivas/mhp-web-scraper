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
		
		let colIndex = headers.indexOf(header);
		if(colIndex > 0){
			return table[rowNum][colIndex];
		} else {
			return 'ERR'
		}
	}

	// Check `richland/Scraper.js` for description of what this function does
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

				// If we are visiting the page for the first time, we will need to accept the disclaimer
				// If we are not visiting the page for the first time, this call will timeout and continue with the 
				// scraping in the next try-block
				await page.waitForSelector("input#ContentPlaceHolder1_btnDisclaimerAccept", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);

				// Click the acknowledge button
				let ackButton = await page.$("input#ContentPlaceHolder1_btnDisclaimerAccept");
				await ackButton.click();
				await page.waitFor(200);
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){
				// console.log(e);
				try{
					// Wait for the owner address field and make sure that it is not empty (if some error occurs while loading, 
					//	or if the table is read before the page completely loads)
					await page.waitForSelector("table#ContentPlaceHolder1_Base_fvOwnerAddress", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
					const ownerTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvOwnerAddress > tbody > tr > td > table.formview > tbody > tr",false);
					
					if(ownerTableData.length < 1){
						throw "Owner Table Not Found";
					}
				}
				catch(e){
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
		

		
		// Get the Owner Name from the Data Profile table
		let parcelInfoTable = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataProfile > tbody > tr > td > table.formview > tbody > tr",false)
		parcelInfoTable = parcelInfoTable.map(row => row[0].trim());
		let baseOwnerName = parcelInfoTable[1];

		// Here is another field for the Owner name, along with the owner address in the Owner Address table
		let ownerTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvOwnerAddress > tbody > tr > td > table.formview > tbody > tr",false);
		ownerTableData = ownerTableData.map(row => row[0].trim());
		let ownerNames = ownerTableData[0];
		let ownerAddress = ownerTableData.slice(1).join(' ');
		console.log(ownerNames);

		// Get the tax mailing information from the Data Mailing Address table
		let taxTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvDataMailingAddress > tbody > tr > td > table.formview > tbody > tr",false);
		taxTableData = taxTableData.map(row => row[0].trim());

		let taxName = taxTableData.slice(0, taxTableData.length - 2).join(' ');
		console.log(taxName);
		let taxAddress = taxTableData.slice(taxTableData.length - 2).join(' ');
		console.log(taxAddress);
		await page.waitFor(200);

		// To access sales information, we will need to go to the 'Sales' page by clicking on the 
		// correct link in the Side Menu

		// Get the hyperlinks (<a> tags) in the side menu
		let sideMenu = await page.$$("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a");
		let transferTag, salePrice, saleDate;

		// In the side menu, we search for the link that has the name 'Sales'
		for(let i = 0; i < sideMenu.length; i++){
			handle = sideMenu[i];
			let prop = await handle.getProperty('innerText');
			let propJSON = await prop.jsonValue();
			if(propJSON === 'Sales') transferTag = handle;
		}


		// We will attempt to go the Sales page multiple times and make sure it has the table 
		//  	that we're looking for before proceeding
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await transferTag.click();
				await page.waitForSelector("table[id='ContentPlaceHolder1_Sales_gvDataSales']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
			}
			catch(e){
				console.log('Unable to visit transfers. Attempt #' + visitAttemptCount);
				continue;
			}
			break;	
		}
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach transfers. Giving up.');		
			// If we can't reach the Sales page for whatever reason, or if we do reach the Sales page
			// 		and there's not sales information, then we will leave these fields blank	
			salePrice = undefined;
			saleDate = undefined;
		} else {

			// If we got this far, then we have sales infromation.
			let transferTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Sales_gvDataSales > tbody > tr",false);

			// Get all the non-empty rows
			transferTableData = transferTableData.filter(row => row.length > 0);

			// The first row is the latest sale (not the same for all websites, could be last row, or some other row)
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


		let scrapedInfo = [undefined, saleDate, salePrice, baseOwnerName, ownerNames, ownerAddress, taxName, taxAddress, undefined, undefined, undefined]; 
		
		
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

				// Wait for acknowledge button as in above function
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

					// To make sure we are on the parcel search page, we will have to click on the 'Parcel' tab in the side menu

					// Get all the links in the side menu
					await page.waitForSelector("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a", {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
					let sideMenu = await page.$$("div.tabsmenu > table > tbody > tr > td > table > tbody > tr > td > a");
					let transferTag;

					// Go through links and search for one which has the title 'Parcel'
					for(let i = 0; i < sideMenu.length; i++){
						handle = sideMenu[i];
						let prop = await handle.getProperty('innerText');
						let propJSON = await prop.jsonValue();
						if(propJSON === 'Parcel') transferTag = handle;
					}

					// Click on this one. Does not open a new page, just loads different fields.
					await transferTag.click();

					// Wait for relevant field and enter parcel information
					await page.waitForSelector("input#ContentPlaceHolder1_Parcel_tbParcelNumber");
					await page.click('input#ContentPlaceHolder1_Parcel_tbParcelNumber', {clickCount: 3});					
					await page.type('input#ContentPlaceHolder1_Parcel_tbParcelNumber', parcelID);

					// Click the search button. Could also be accomplished by just automating pressing 'Enter'
					const searchButton = await page.$('input#ContentPlaceHolder1_Parcel_btnSearchParcel');
					await searchButton.click();
					
					// We get a table with search results. We need to click on the first search result.
					await page.waitForSelector("table#ContentPlaceHolder1_gvSearchResults", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);

					// Get the link of the first search result in the table and click the link to go to the property page.
					const parcelURL = await page.$("table#ContentPlaceHolder1_gvSearchResults > tbody > tr > td > a");
					await parcelURL.click();
					page.waitFor(200);
					
					// Wait for Owner address table to make sure we've reached the property page.
					await page.waitForSelector("table#ContentPlaceHolder1_Base_fvOwnerAddress", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
					const ownerTableData = await this.getTableDataBySelector(page, "table#ContentPlaceHolder1_Base_fvOwnerAddress > tbody > tr > td > table.formview > tbody > tr",false);
					
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
		
		// Get the URL and call scrapeByPropertyURL with this as always.
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
