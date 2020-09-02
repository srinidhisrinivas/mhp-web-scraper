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
	this.getCardDataBySelector = async function(page, selector, html, header){
		if(html){
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('div');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('div');
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
				await page.goto(propertyURL, {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				
				await page.waitForSelector("div.card > table.table",{timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				await page.waitFor(200);

				const ownerTableData = await this.getTableDataBySelector(page, "div.card > table.table tr",false);
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

		let headTableData = await this.getTableDataBySelector(page, "div.mt-3 table.table tr", false);
		headTableData = headTableData.shift();
		headTableData = headTableData.filter(e => e.trim() !== '');
		headTableData = headTableData[0].split('\n');
		let baseOwnerName = headTableData[headTableData.indexOf('Owner') + 1];
		console.log(baseOwnerName);
		
		let cardData = await this.getCardDataBySelector(page, "div.card.mt-3", false);
		cardData = cardData.filter(card => card.includes('Taxpayer') || card.includes('Deed') || card.includes('Owner'));
		// cardData = cardData.slice(3);

		let deedCardData = cardData.filter(card => card.includes('Deed'))[0];
		deedCardData = deedCardData.filter(row => row.includes('Sales'))[0];
		deedCardData = deedCardData.split('\n');
		deedCardData = deedCardData.filter(e => e.trim() !== '');
		deedCardData = deedCardData.map(e => e.trim());

		let transferAmount = deedCardData[deedCardData.indexOf('Sales Amount') + 1];
		let transferDate = deedCardData[deedCardData.indexOf('Date Sold') + 1];
		
		let ownerCardData = cardData.filter(card => card.includes('Owner'))[0];
		ownerCardData = ownerCardData.filter(row => row.includes('Contact'))[0];
		ownerCardData = ownerCardData.split('\n');
		ownerCardData = ownerCardData.filter(e => e.trim() !== '');
		ownerCardData = ownerCardData.map(e => e.trim());
		
		let ownerHeadIndex = ownerCardData.indexOf('Owner Name');
		let addressField = ownerCardData.slice(0,ownerHeadIndex);
		addressField.shift();
		addressField.shift();
		let ownerAddress = addressField.join(' ');
		let nameField = ownerCardData.slice(ownerHeadIndex);
		nameField.shift();
		let ownerNames = nameField[0];


		console.log(ownerNames);
		console.log(ownerAddress);

		let taxCardData = cardData.filter(card => card.includes('Taxpayer'))[0];
		taxCardData = taxCardData.filter(row => row.includes('Contact'))[0];
		taxCardData = taxCardData.split('\n');
		taxCardData = taxCardData.filter(e => e.trim() !== '');
		taxCardData = taxCardData.map(e => e.trim());
		taxCardData.shift();

		let taxName = taxCardData[0];
		let taxAddress = taxCardData.slice(1).join(' ');
		console.log(taxName);
		console.log(taxAddress);

		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferAmount = undefined;

		console.log(transferAmount);
		console.log(transferDate);

		let scrapedInfo = [undefined, transferDate, transferAmount, baseOwnerName, ownerNames, ownerAddress, taxName, taxAddress, undefined, undefined, undefined]; 

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

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(auditorURL);
				await page.type("input#Number", parcelID);
				await page.evaluate(() => {
					document.querySelector("button.btn-primary").click();
				});
				await page.waitForSelector("table.table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				await page.waitForSelector("table.table > tbody > tr > td > a", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.evaluate(() => {
					document.querySelector("table.table > tbody > tr > td > a").click();
				});
				await page.waitFor(200);
				await page.waitForSelector("div.mt-3 table.table",{timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				const ownerTableData = await this.getTableDataBySelector(page, "div.mt-3 table.table tr",false);
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
