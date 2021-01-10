const InfoParser = require('../../InfoParser.js');
const puppeteer = require('puppeteer');
const ConfigReader = require('../../ConfigReader.js');
const ErrorLogger = require("../../ErrorLogger.js");
const DateHandler = require("../../DateHandler.js");

const ERROR_LOGGER = new ErrorLogger('delaware');
const CONFIG = new ConfigReader('delaware');


/**
	How does web scraping with puppeteer work? 

	You have a browser object and a page object. A page object is basically a tab within
	the browser, and you use the page for most of the web navigation functions.

	With the page object, navigate to the desired URL.

	To extract the information on the page, you will have to find the specific
	id or 'selector' (look up CSS Selectors if you need help understanding this) of the HTML
	element that you're looking to collect information from. This you can do with a 
	simple 'Right Click > Inspect Element' in another browser that you open the link in.

	Getting the right element and the correct information from it in the correct format can 
	sometimes be tedious. It typically involves trial and error. Try to scrape the information
	one by one and print your progress along the way instead of scraping everything at once.

	Functions:

		page.goto(URL) - go to URL. Typically followed by a wait before proceeding.

		page.waitForSelector(selector, {timeout: msecs}) - wait for a particular selector to load before proceeding.

		page.waitFor(msecs) - wait for a particular amount of time before proceeding.

		page.$(selector) - Get the JSHandle of a particular element. More on JSHandles in puppeteer documentation.

		page.$$(selector) - Get multiple JSHandles that match the selector as a list.

		page.eval(selector, function) - pass the JSHandle to `function` and perform some operation on the element in the function.
**/
let Scraper = function(){

	/**
		Gets table information in the form of a 2D array based on the selector 
		of the table passed to the function.
	**/
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

	/**
		Extracts information from a particular row if the table contains
		headers in the rows instead of the columns.

		Specifically for tables which have only two columns, one of which 
		is the header, the other of which is the value for that header.

		Args

			table - 2D Array of table information

			header - String. the row header to match and return information from

			delimiter - character. if the information spans over more than one row
						for the same header, use this delimiter to decide how the 
						the rows will be separated in the final output string.


		Returns
			info - String of the value of the table at that given row header.


	**/
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

	/**
		
		Get information for a particular column and a row number.

		Args
			table - 2D array of table information

			header - String. Column header to collect information from.

			rowNum - int. Row number to collect information from.

		Returns

			info - String. The information contained under the column with
					header `header` and row number `rowNum`

	**/
	this.getInfoFromTableByColumnHeader = async function(table, header, rowNum){
		let headers = table.shift();
		
		let colIndex = headers.indexOf(header);
		if(colIndex > 0){
			return table[rowNum][colIndex];
		} else {
			return 'ERR'
		}
	}


	/**
		Scrapes information specifically for Richland county from the received property URL.

		Args

			page - puppeteer page object

			propertyURL - String. URL of the property to be searched.

		Returns

			scrapedInformation object
			{
				return_status: return code as defined in `config/dev_config.json`,
				scraped_information: array of information collected for this property page.
			}


	**/
	this.scrapeByPropertyURL = async function(page, propertyURL){

		// Return error if no property URL passed.
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		
		// Attempt to visit the property page only a certain number of times.
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){


			try{

				// Navigate to page
				await page.goto(propertyURL);

				// Website has an acknowledge button that shows up the first time you visit it each time.
				// Wait for this button
				await page.waitForSelector("div.modal-footer > a.btn", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);

				// If button found, get button handle and store in variable.
				let ackButton = await page.$("div.modal-footer > a.btn");

				// Click button
				await ackButton.click();
				await page.waitFor(200);

				// Throw fake error to continue
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){

				// Come here if either:
				// (1) There is an error in waiting for the 'ack button' on the website, which means that the dialog 
				//			box did not appear, so we can proceed with scraping.
				// (2) If the 'ack button' on the website was clicked, throwing a fake error, so we can proceed
				//			with scraping.
				try{

					// Wait for the main information section that we scrape from
					await page.waitForSelector("section#ctlBodyPane_ctl01_mSection", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
				} catch(e){
					// If the information section doesn't appear, rerun loop to try again.
					console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
					continue;
				}
			}
			
			
			// If no errors in second try-block, we have the correct page, so break from loop.
			break;	
		}

		// If we failed to reach the website after a certain number of tries, we will return an error.
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + propertyURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		

		// Get the owner names. Sometimes appears as a link on this website.
		let owner1Handle = await page.$('span#ctlBodyPane_ctl01_ctl01_lnkOwnerName1_lblSearch');
		let owner1Link = await page.$('a#ctlBodyPane_ctl01_ctl01_lnkOwnerName1_lnkSearch');
		let prop;

		// Get the owner name either from either the link or the text field.
		// This is how you get the innerText property from a JSHandle
		if(owner1Handle) prop = await owner1Handle.getProperty('innerText');
		else if(owner1Link) prop = await owner1Link.getProperty('innerText');
		let baseOwnerName = await prop.jsonValue();


		// Get the second owner name and append to first owner name.
		let owner2Handle = await page.$('span#ctlBodyPane_ctl01_ctl01_lblOwnerName2');
		prop = await owner2Handle.getProperty('innerText');
		baseOwnerName += ' ' + await prop.jsonValue();
		console.log(baseOwnerName);

		// Get the mailing tax name and address and manipulate them to get it as a string.
		let mailingHandle = await page.$('span#ctlBodyPane_ctl01_ctl01_lblMailing');
		prop = await mailingHandle.getProperty('innerText');
		let taxInfo = await prop.jsonValue();
		taxInfo = taxInfo.split('\u000A');
		taxInfo.shift();
		let taxName = taxInfo.shift();
		let taxAddress = taxInfo.join(' ');
		console.log(taxName);
		console.log(taxAddress);

		// Get the sales table data using the selector
		// When using this function, make sure you pass the `tr` element under the table selector
		// Can also be done like "table#ctlBodyPane_ctl12_ctl01_gvwSales tr" which gives `tr` present in the selector.
		let salesTableData = await this.getTableDataBySelector(page, "table#ctlBodyPane_ctl12_ctl01_gvwSales > tbody > tr",false);
		salesTableData = salesTableData.shift();
		let transferAmount = '', transferDate = '';

		// If sales table data was found, get the relevant information from the sales table.
		if(salesTableData !== undefined){
			transferAmount = salesTableData[5];
			transferDate = salesTableData[0];
		}

		// Convert the sales amount to int
		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;

		// Convert the sales date to a MM/DD/YYYY format
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferAmount = undefined;

		console.log(transferAmount);
		console.log(transferDate);
		
		console.log('\n');

		// Should ideally be done using the IDX fields in `config/dev_config.json` but I was too lazy.
		// Order of information to be passed back. This is the same as the order of the columns in the excel sheet:
		// 0 - Parcel ID (left `undefined` because this doesn't change and will be copied from old information in `src/index.js`)
		// 1 - Latest Sale Date 
		// 2 - Latest Sale Price
		// 3 - Owner Name
		// 4 - Other field for owner name. (undefined for this website, some sites have multiple fields for owner names.)
		// 5 - Owner Address (undefined because field not present on this website.)
		// 6 - Mailing Tax Name
		// 7 - Mailing Tax Address
		// 8 - County (undefined because this doesn't change)
		// 9 - Property URL (undefined because if the property URL worked, it doesn't need to be changed.)
		// 10 - Auditor URL (undefined because this doesn't change.)
		let scrapedInfo = [undefined, transferDate, transferAmount, baseOwnerName, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 
		
		
		return {
			scraped_information: scrapedInfo,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

	/**
		Scrapes information specifically for Richland county from the received auditor URL.

		This is used when the first propertyURL didn't work. Searches the website using the parcelID,
		retrieves the correct link to the property page, and then scrapes information using the above function
		`this.scrapeByPropertyURL`

		Args

			page - puppeteer page object

			auditor - String. URL of the auditor's website parcel search page.

			parcelID - parcelID of the property whose information is to be found

		Returns

			scrapedInformation object
			{
				return_status: return code as defined in `config/dev_config.json`,
				scraped_information: array of information collected for this property page.
			}


	**/
	this.scrapeByAuditorURL = async function(page, auditorURL, parcelID){
		if(auditorURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		
		// Parcels of this county are of varying lengths.
		// Some shorter parcels will not work if you search for just the parcel number as it is in the 
		// 			Excel document.
		// This website requires a 13 digit parcel number, so any parcel number shorter than that is 
		//			padded with zeros up to 13 digits.
		let prefixLength = 13 - parcelID.length;
		if(prefixLength > 0) parcelID = "0".repeat(prefixLength) + parcelID;


		// Attempt to visit the auditor's page a certain number of times.
		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{

				// Go to auditor's page and wait for acknowledge button as in previous function.
				await page.goto(auditorURL);
				await page.waitForSelector("div.modal-footer > a.btn", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);
				let ackButton = await page.$("div.modal-footer > a.btn");
				await ackButton.click();
				await page.waitFor(200);
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){
				try{
			
					// Parcel ID text field
					await page.waitForSelector("input#ctlBodyPane_ctl02_ctl01_txtParcelID");

					// Triple click text field to select all text present in it already
					// This is done to select all the text so that we replace the pre-existing text
					//	 	when we type a new parcel ID
					await page.click('input#ctlBodyPane_ctl02_ctl01_txtParcelID', {clickCount: 3});					

					// Type the parcel ID in the field
					await page.type('input#ctlBodyPane_ctl02_ctl01_txtParcelID', parcelID);

					// Get and click the search button
					const searchButton = await page.$('a#ctlBodyPane_ctl02_ctl01_btnSearch');
					await searchButton.click();
					await page.waitFor(200);

					// Search for the information section on the property page, to confirm that we have found 
					// 		a property from the given search.
					await page.waitForSelector("section#ctlBodyPane_ctl01_mSection", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
				
				} catch(e){
					// If any of the above `waitFors` times out, then that means we were unable to reach the page. Try again.
					console.log(e);
					console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);
					continue;
				}
			}
			
			
			break;	
		}

		// Return error if failed too many times.
		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + auditorURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		
		// If we made it this far, then we have found a property with the parcel URL and
		//		we are currently on that property page.

		// Get the property URL from the page.
		let propertyURL = page.url();

		// Call the `scrapeByPropertyURL` function with the found URL
		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL);

		// Replace the property URL field in the returned information with the new property URL found.
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		// Return
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}

// ....aaand that is all the process of scraping information from the page is!
module.exports = Scraper

