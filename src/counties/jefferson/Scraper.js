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
					if(!row[row.length - 1].includes("LIEN") && !row[row.length - 1].includes("SOLD")) info += delimiter + ' ' + row[row.length - 1];
				} else {
					inTargetHeader = false;
					break;
				}
			} 
			else if(rowHeader.includes(header)){
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


	this.scrapeByPropertyURL = async function(page, propertyURL, parcelID, fromBrowser){
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		// console.log('Receive call to property with URL: '+propertyURL);
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			
			try{
				if(!fromBrowser) await page.goto(propertyURL);
				await page.waitForSelector("a[href='#SalesData']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
				if(fromBrowser) await page.goto(propertyURL);

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
		let allTableData = await this.getTableDataBySelector(page,'table tr', false);
		let ownerHeaderIdx = 4;
		let addressHeaderIdx = 6;
		for(let i = 0; i < allTableData.length; i++){
			if(allTableData[i].includes('Owner')){
				ownerHeaderIdx = i;
			} else if(allTableData[i].includes('Owner Address')){
				addressHeaderIdx = i;
				break;
			}

		}
		let ownerRow = allTableData[ownerHeaderIdx + 1];
		let ownerNames = ownerRow[1];
		ownerNames = ownerNames.toUpperCase();

		console.log(ownerNames);
		let addressRow1 = allTableData[addressHeaderIdx + 1];
		let addressRow2 = allTableData[addressHeaderIdx + 2];
		let ownerAddress = addressRow1[addressRow1.length - 1] + ' ' + addressRow2[addressRow2.length - 1];
		ownerAddress = ownerAddress.toUpperCase();
		console.log(ownerAddress);
		
		let scrapedInfo = [undefined, undefined, undefined, ownerNames, undefined, ownerAddress, undefined, undefined, undefined, undefined, undefined]; 
		
		
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.click("input[value*='Parcel History']");
				await page.waitFor(200);
				await page.waitForSelector("table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
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
			let conveyanceTableData = await this.getTableDataBySelector(page, "table tr", false);
			conveyanceTableData.shift();
			// console.log(conveyanceTableData);
			conveyanceTableData = conveyanceTableData.filter(row => row[2].length > 0);
			// console.log(conveyanceTableData);
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
			let transferDate = '', transferAmount = '';
			if(latestTransferData !== undefined){
				
				transferDate = latestTransferData[2];

				transferAmount = latestTransferData[3];
				
				// console.log(transferAmount);
			}
			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
			else transferDate = undefined;

			console.log(transferAmount);
			console.log(transferDate);

			scrapedInfo[CONFIG.DEV_CONFIG.DATE_IDX] = transferDate;
			scrapedInfo[CONFIG.DEV_CONFIG.PRICE_IDX] = transferAmount;
		}
		
		console.log('\n');
		if(fromBrowser) await page.close();
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
		
		let visitAttemptCount, propertyURL, i, propertyPage;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);
				await page.bringToFront();
				await page.waitForSelector('div.main-contain-reg', {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC})
				let transferTag;
				let sideMenu = await page.$$("div.form-group.col-md-6");
				//console.log(sideMenu);
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					const title = await handle.$eval('label', l => l.innerText);
					const inp = await handle.$eval('input', i => i);
					
					if(title.includes('Parcel')) transferTag = handle;
				}
				await transferTag.click({clickCount: 3});
				await transferTag.type(parcelID);
				await page.waitFor(200);
				
				await page.keyboard.press('Enter');
				await page.waitFor(200)

				
				await page.waitForSelector('tr.clickable', {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
				await page.waitFor(200);

				await page.click("tr.clickable");
				await page.waitFor(1000);

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
						
						if(lastURL === auditorURL) continue;
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
		
			
			break;	
		}

		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS || propertyURL === undefined){
			console.log('Failed to reach ' + auditorURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
			// console.log('did not return?');
		}
		// console.log(propertyURL);
		// console.log('Making a call to property');
		let scrapedInfo = await this.scrapeByPropertyURL(propertyPage, propertyURL, parcelID, true);
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}


module.exports = Scraper;


// run();
