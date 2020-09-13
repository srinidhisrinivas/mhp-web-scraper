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
				const iframe = page.frames()[2];

				await iframe.waitForSelector("table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await iframe.waitFor(200);
				
				const ownerTableData = await this.getTableDataBySelector(iframe, "table tr",false);
				// console.log(ownerTableData);
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
		const iframe = page.frames()[2];

		let allTableData = await this.getTableDataBySelector(iframe, "table tr",false);
		// allTableData = allTableData.filter(row => row.length > 0);
		allTableData = allTableData.filter(row => row.some(e => e.trim().length > 0));

		// console.log(allTableData);
		
		let ownerTableData = allTableData.filter(row => row.includes('OWNER'))[0];
		let ownerNames = ownerTableData[1];
		console.log(ownerNames);

		let taxTableData = allTableData.filter(row => row.some(e => e.includes('MAILING ADDRESS')))[0][0];
		taxTableData = taxTableData.split('\n');
		taxTableData.shift();
		let taxName = taxTableData.shift();
		let taxAddress = taxTableData.join(' ');
		console.log(taxName);
		console.log(taxAddress);

		let salesData = allTableData.filter(row => row.some(e => e.includes('DATE')) && row.some(e => e.includes('SALE')));
		let transferAmount = '', transferDate = '';
		if(salesData.length > 0){
			salesData = salesData[0];
			let dates = salesData[0].split('\n');
			dates.shift();
			let amts = salesData[3].split('\n');
			amts.shift();
			transferDate = dates.shift();
			transferAmount = amts.shift();
			if(dates.length > 0){
				let secondDate = dates.shift();
				let secondAmt = amts.shift();

				if(transferAmount === '' && secondDate === transferDate){
					transferAmount = secondAmt;
				}
			}
		}

		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferDate = undefined;

		console.log(transferAmount);
		console.log(transferDate);
		let scrapedInfo = [undefined, transferDate, transferAmount, ownerNames, undefined, undefined, undefined, taxAddress, undefined, undefined, undefined]; 
		

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
		let prefixLength = 7 - parcelID.length;
		if(prefixLength >= 0) parcelID = "0".repeat(prefixLength) + parcelID;
		// console.log('Received call to auditor with parcelID: ' + parcelID);
		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);

				// await page.setContent('<iframe></iframe>');

				// const iframe = page.frames()[1];
				// console.log(iframe);
				// fetch the body element of the iframe

				// let bodyHTML = await iframe.evaluate(() => document.body.innerHTML);
				// console.log(bodyHTML);

				await page.waitForSelector("input[name='parcel']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				await page.click("input[name='parcel']", {clickCount: 3});					
				await page.type("input[name='parcel']", parcelID);

				
				await page.keyboard.press('Enter');
				await page.waitFor(500);

				const iframe = page.frames()[2];

				await iframe.waitForSelector("table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await iframe.waitFor(200);
				
				const ownerTableData = await this.getTableDataBySelector(iframe, "table tr",false);
				// console.log(ownerTableData);
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


module.exports = Scraper

function infoValidator(info, processedInformation){
	let valid = false;
	if(info.transfer < info.value && info.transfer > 0) valid = true;
	if(processedInformation.some(e => e.owner === info.owner)) valid = false;	
	return valid;
	
}	


// run();
