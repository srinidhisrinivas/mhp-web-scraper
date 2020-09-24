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
			    const columns = row.querySelectorAll('th, td');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('th, td');
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

				await page.waitForSelector("div#loading.hidden", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				// await page.waitForSelector("div[id*='uniqName'] span.col-xs-7", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				// await page.waitFor(200);
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
		const ownerDivHandle = await page.$("div#uniqName_7_0");
		let prop = await ownerDivHandle.getProperty('innerText');
		let ownerDivText = await prop.jsonValue();
		ownerDivText = ownerDivText.split('\n');
		// console.log(ownerDivText);
		
		let ownerNames = ownerDivText[ownerDivText.indexOf('Owner Name:') + 1];
		console.log(ownerNames);


		let ownerTableData = await this.getTableDataBySelector(page, "table.table tr", false);
		// console.log(ownerTableData);
		// let bodyHTML = await page.evaluate(() => document.body.innerHTML);
		// console.log(bodyHTML);
		const mailingDivHandle = await page.$("div#uniqName_7_2");
		prop = await mailingDivHandle.getProperty('innerText');
		let mailingDivText = await prop.jsonValue();

		// console.log(mailingDivText);
		mailingDivText = mailingDivText.split('\n');
		mailingDivText = mailingDivText.filter(e => e === e.toUpperCase());

		// console.log(mailingDivText);

		let taxName = mailingDivText.shift();
		let taxAddress = mailingDivText.join(' ');

		
		console.log(taxName);
		console.log(taxAddress);

		let conveyanceTableData = ownerTableData.filter(row => row.some(e => !e.includes('(') && e.includes('$')) && row.some(e => e.match(/\/[0-9]*\//)));
		
		let transferAmount='', transferDate='';
		if(conveyanceTableData.length > 0){
			let dates = conveyanceTableData.map(row => new Date(row[2]));
			let maxDateIdx = 0;
			for(let i = 1; i < dates.length; i++){
				let currDate = dates[i];
				if(currDate >= dates[maxDateIdx]){
					maxDateIdx = i;
				}
			}

			let latestTransferData = conveyanceTableData[maxDateIdx];
			// console.log(latestTransferData);
			// console.log(latestTransferData);
			if(latestTransferData !== undefined){
				
				transferDate = latestTransferData[0];

				transferAmount = latestTransferData[1];
				
				// console.log(transferAmount);
			}	
		}
		
		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferDate = undefined;

		if(isNaN(transferAmount)) transferAmount = undefined;

		console.log(transferDate);
		console.log(transferAmount);

		let scrapedInfo = [undefined, transferDate, transferAmount, ownerNames, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 

		console.log('\n');
		// await page.close();

		return {
			scraped_information: scrapedInfo,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

	this.scrapeByAuditorURL = async function(page, auditorURL, parcelID, browser){
		if(auditorURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		parcelID = parcelID.replace(/[\*\.]/g,'');

		let prefixLength = 16 - parcelID.length;
		if(prefixLength >= 0) parcelID = "0".repeat(prefixLength) + parcelID;

		let visitAttemptCount, propertyURL, i, propertyPage, elementSrc;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);
				await page.bringToFront();

				await page.waitForSelector("iframe#myIframe");
				await page.waitFor(200);

				elementSrc = await page.$eval('iframe#myIframe', e => e.src);
				
				await page.goto(elementSrc);
				
				await page.waitForSelector("button.navbar-toggle", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.click("button.navbar-toggle");
				await page.waitFor(200); 

				throw "Nav bar Toggle Clicked";
			} catch(e){
				// console.log(e);

				try{
					await page.waitFor(200);
					await page.waitForSelector("li.basic-search a");
					await page.click("li.basic-search a");					
					await page.waitFor(200);

					await page.waitForSelector("input.form-control[name='PIN']");
					await page.click("input.form-control[name='PIN']", {clickCount: 3});					
					await page.type("input.form-control[name='PIN']", parcelID, {delay: 100});
					await page.keyboard.press('Tab');
					await page.waitFor(200);
// 
					const searchButton = await page.$("button.btn-primary.pull-right");
					await searchButton.click();
					await page.waitFor(200);

					await page.waitForSelector("div#widget-query-results a.view-report-link", {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
					await page.waitFor(200);

					const reportLink = await page.$("div#widget-query-results a.view-report-link");
					let href = await page.$eval('#widget-query-results a.view-report-link', e => e.href);
					href = href.substring(href.indexOf('/'));
					let url = page.url();
					url = url.substring(0, url.indexOf('/'));
					url = url + href;

					propertyURL = url;
					// propertyPage = await browser.newPage();

				} catch(e){
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
		
		// let propertyURL = page.url();
		// console.log(propertyURL);
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
