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
				
				await page.waitForSelector("td[width='66%'] > table.ui-corner-all", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "td[width='66%'] > table.ui-corner-all > tbody > tr",false);
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

		const ownerTableData = await this.getTableDataBySelector(page, "td[width='66%'] > table.ui-corner-all > tbody > tr",false);
		//console.log('Owner Table Data:');
		
		//console.log(ownerTableData);
		let ownerNames = await this.getInfoFromTableByRowHeader(ownerTableData, 'Owner Name', ',');
		console.log(ownerNames);


		var taxTableData = await this.getTableDataBySelector(page, "td[width='34%'] > table.ui-corner-all > tbody > tr",false);
		taxTableData = taxTableData[taxTableData.length - 1][0];
		taxTableData = taxTableData.split('\n');
		let taxName = taxTableData.slice(0, taxTableData.length - 3).join(' ');
		console.log(taxName);
		let taxAddress = taxTableData.slice(taxTableData.length - 3).join(' ');
		console.log(taxAddress);

		let transferTableData = await this.getTableDataBySelector(page, "td[colspan='2'] > table.ui-corner-all > tbody > tr",false);
		transferTableData = transferTableData.filter(row => row.includes('Amount') || row.includes('Sale Date'));
		
		transferTableData = transferTableData.map(row => row[row.length - 1]);
		console.log(transferTableData);
		let salePrice = parseInt(transferTableData[0].replace(/[,\$]/g, ''));
		let saleDate = DateHandler.formatDate(new Date(transferTableData[1]));


		let scrapedInfo = [undefined, saleDate, salePrice, ownerNames, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 
		
		
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
				await page.goto(auditorURL);
				await page.type('input#owner', parcelID);
				const searchButton = await page.$('button[name=btnSearch]');
				await searchButton.click();
				await page.waitForSelector("td[colspan='2'] > table.ui-corner-all", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "td[width='66%'] > table.ui-corner-all > tbody > tr",false);
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
				
			}
			catch(e){
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
