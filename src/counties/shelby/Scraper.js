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
				
				await page.waitForSelector("div#loading.hidden", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				// await page.waitForSelector("div[id*='uniqName'] span.col-xs-7", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				// await page.waitFor(200);
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);
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
		const ownerDivHandle = await page.$("div[id*='uniqName'");
		let prop = await ownerDivHandle.getProperty('innerText');
		let ownerDivText = await prop.jsonValue();
		ownerDivText = ownerDivText.split('\n');
		// console.log(ownerDivText);
		
		let ownerNames = ownerDivText[ownerDivText.indexOf('Owner:') + 1];
		console.log(ownerNames);


		let ownerTableData = await this.getTableDataBySelector(page, "table.table tr", false);

		let taxNameInfo = ownerTableData.filter(row => row.includes('Mailing Name'))[0];
		let taxAddressInfo = ownerTableData.filter(row => row.includes('Mailing Address'))[0];
		// console.log(taxNameInfo);
		// console.log(taxAddressInfo);

		let taxName, taxAddress;
		if(taxNameInfo !== undefined) taxName = taxNameInfo[1];
		if(taxAddressInfo !== undefined) taxAddress = taxAddressInfo[1];
		// ownerTableData = ownerTableData.slice(ownerTableData.length / 2);
		// let bodyHTML = await page.evaluate(() => document.body.innerHTML);
		// console.log(bodyHTML);	
		console.log(taxName);
		console.log(taxAddress);

		let conveyanceTableData = ownerTableData.filter(row => row.some(e => e.includes('$')) && row.some(e => e.match(/\/[0-9]*\//)));
		
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
		let transferDate = '', transferAmount = '';
		if(latestTransferData !== undefined){
			
			transferDate = latestTransferData[2];

			transferAmount = latestTransferData[latestTransferData.length - 1];
			
			// console.log(transferAmount);
		}
		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferDate = undefined;

		console.log(transferDate);
		console.log(transferAmount);

		let scrapedInfo = [undefined, transferDate, transferAmount, ownerNames, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 

		console.log('\n');
		await page.close();

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

		parcelID = parcelID.replace(/-/g, '');
		// let prefixLength = 10 - parcelID.length;
		// if(prefixLength >= 0) parcelID = "0".repeat(prefixLength) + parcelID;
		// console.log('Received call to auditor with parcelID: ' + parcelID);
		let visitAttemptCount, propertyURL, i, propertyPage, elementSrc;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);
				await page.bringToFront();

				await page.waitForSelector("iframe#map-iframe");
				await page.waitFor(200);

				elementSrc = await page.$eval('iframe#map-iframe', e => e.src);
				
				// console.log(elementSrc);

				await page.goto(elementSrc);
				// const iframe = await elementHandle.contentFrame();
				// console.log(iframe);
				// // const frames = page.frames();
				// // console.log(frames);

				// // const iframe = frames[0];
				// let bodyHTML = await page.evaluate(() => document.body.innerHTML);
				// console.log(bodyHTML);
				await page.waitForSelector("div#widget-splash");

				await page.waitFor(200);
				let bodyHTML = await page.evaluate(() => document.body.innerHTML);
				// console.log(bodyHTML);

				await page.waitForSelector("div.splash-widget.open button.btn.btn-primary", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);

				await page.click("div#widget-splash button.btn.btn-primary");
				await page.waitFor(200); 

				throw "Acknowledge Button Clicked";

			} catch(e){
				// console.log(e);

				try{
					await page.waitForSelector("button.navbar-toggle", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
					await page.click("button.navbar-toggle");
					await page.waitFor(200); 

					throw "Nav bar Toggle Clicked";
				} catch(e){
					// console.log(e);

					try{
						await page.waitFor(200);
						await page.waitForSelector("li.basic-search");
						await page.click("li.basic-search");					
						await page.waitFor(200);

						await page.waitForSelector("input.form-control[name='PIN']");
						await page.click("input.form-control[name='PIN']", {clickCount: 3});					
						await page.type("input.form-control[name='PIN']", parcelID, {delay: 100});
						await page.waitFor(200);
// 
						const searchButton = await page.$("button.btn-primary.pull-right");
						await searchButton.click();
						await page.waitFor(200);

						await page.waitForSelector("div#widget-query-results a.view-report-link", {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
						await page.waitFor(200);

						await page.click("div#widget-query-results a.view-report-link");
						await page.waitFor(200);

						throw "Parcel clicked";	
					} catch(e){
						// console.log(e);
						try{
							let lastURL, pages;
							
							for(i = 0; i < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; i++){
								await page.waitFor(1000);
								pages = await browser.pages();
								let pageURLs = pages.map(p => p.url());
								lastURL = pageURLs[pageURLs.length-1];
								
								if(lastURL === elementSrc) continue;
								else break;
							}
							if(i === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS) throw "Did not find page URL";
							propertyURL = lastURL;
							propertyPage = pages[pages.length - 1];

						} catch(e){
							console.log(e);
							console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);

							continue;
						}
					}	

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
		let scrapedInfo = await this.scrapeByPropertyURL(propertyPage, propertyURL, parcelID);
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
