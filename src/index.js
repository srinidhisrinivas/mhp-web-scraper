const puppeteer = require('puppeteer');
const fs = require('fs');
const Excel = require('exceljs');
const ExcelWriter = require('./ExcelWriter.js');
const DateHandler = require('./DateHandler.js');
const InfoParser = require('./InfoParser.js');

const ConfigReader = require('./ConfigReader.js');
const CONFIG = new ConfigReader();
const RUN_TYPE = CONFIG.USER_CONFIG.RUN_TYPE; // "all", "between", or "one";
const BETW_1 = CONFIG.USER_CONFIG.BETW_1; // start county if `RUN_TYPE` is 'between'. empty otherwise
const BETW_2 = CONFIG.USER_CONFIG.BETW_2; // end county if `RUN_TYPE` is 'between'. empty otherwise
const ONE = CONFIG.USER_CONFIG.ONE; // county name if `RUN_TYPE` is 'one'. empty otherwise
const EXCLUDED_COUNTY_LIST = []; // to exclude any counties
const TARGET_COUNTY_LIST = [];

// List of counties for which a scraper was written.
// Each of these counties (and only these counties) will have a folder + `Scraper.js` file in `src/counties/`
const LAYOUT_COUNTY_LIST = ['adams',
							'allen',
							'ashtabula',
							'athens',
							'auglaize',
							'brown',
							'butler',
							'champaign',
							'clark',
							'clermont',
							'clinton',
							'coshocton',
							'crawford',
							'delaware',
							'fairfield',
							'fayette',
							'franklin',
							'gallia',
							'geauga',
							'greene',
							'guernsey',
							'hamilton',
							'hardin',
							'harrison',
							'henry',
							'hocking',
							'huron',
							'jefferson',
							'licking',
							'lucas',
							'marion',
							'medina',
							'montgomery',
							'noble',
							'ottawa',
							'richland',
							'ross',
							'shelby',
							'stark',
							'summit',
							'trumbull',
							'vinton',
							'warren',
							'washington',
							'wood',
							'wyandot'];

// These are the counties which had website layouts exactly the same as 
// one of the counties in `LAYOUT_COUNTY_MAP`.
// For example, Ashland county's website was the same as Allen county, so 
// the same scraper used for Allen county, `counties/allen/Scraper.js`, can 
// be used for Ashland county without any changes.
const COUNTY_MAP = {
	'ashland' : 'allen',
	'belmont' : 'allen',
	'carroll' : 'brown',
	'columbiana' : 'allen',
	'darke' : 'adams',
	'defiance' : 'adams',
	'erie' : 'auglaize',
	'fulton' : 'adams',
	'hancock' : 'guernsey',
	'highland' : 'adams',
	'holmes' : 'adams',
	'jackson' : 'auglaize',
	'knox' : 'adams',
	'lake' : 'auglaize',
	'lawrence' : 'adams',
	'logan' : 'brown',
	'madison' : 'champaign',
	'mahoning' : 'allen',
	'meigs' : 'auglaize',
	'miami' : 'adams',
	'monroe' : 'crawford',
	'morgan' : 'brown',
	'morrow' : 'adams',
	'muskingum' : 'adams',
	'paulding' : 'adams',
	'perry' : 'guernsey',
	'pickaway' : 'auglaize',
	'pike' : 'henry',
	'portage' : 'adams',
	'preble' : 'auglaize',
	'putnam' : 'crawford',
	'sandusky' : 'adams',
	'scioto' : 'allen',
	'seneca' : 'auglaize',
	'tuscarawas' : 'brown',
	'union' : 'henry',
	'van wert' : 'crawford',
	'wayne' : 'adams',
	'williams' : 'adams',
	'wyandot' : 'crawford'

};

// Maps a `Scraper` object to each of the county names for which there exists a `Scraper.js` file
const SCRAPER_MAP = {};
LAYOUT_COUNTY_LIST.forEach((county) => {
	SCRAPER_MAP[county] = require('./counties/'+county+'/Scraper.js');
});

// Not sure if this variable is used.
let numErrors = 0;

/**
	Main execution loop. Program starts here. Executes 'cycles' of the program, which is just
	scraping until the program either completes or causes an error, until all of the information
	has been processed.

	Args:
		infilepath: String of the input Excel file name.

		headless: String to indicate whether browsing with puppeteer occurs
					headless or not. 'true' = no browser display, 'false' = browser display

	Returns:
		Return Status Object
**/
async function run(infilepath, headless){

	let remainingInfo, finalpath, lastErroredParcel = '', numLastLinkErrors = 1;

	// Display starting time for timing purposes
	console.log('Starting at:');
	let beginTime = new Date();
	console.log(beginTime.toString() + '\n');
	
	// Convert string to boolean
	headless = (headless === 'true');
	
	// Continues running until program returns with success code
	while(true){
		
		// Run the program for one cycle. Cycles occur continuously until an error occurs or the program is complete.		
		let returnStatus = await runCycle(infilepath, remainingInfo, finalpath, headless, numLastLinkErrors);

		// Reset the number of times the last link errored
		if(numLastLinkErrors === CONFIG.DEV_CONFIG.MAX_LINK_ERRORS) numLastLinkErrors = 1;

		// `runCycle` returned successfully
		if(returnStatus.code === CONFIG.DEV_CONFIG.SUCCESS_CODE){
			
			// log success
			console.log('Success');
			console.log('Output file is: ' + returnStatus.finalpath);

			// Display ending time for timeing purposes
			console.log('\nFinished at:');
			let endTime = new Date();
			console.log(endTime.toString() + '\n');
			console.log('Number of errors: ' + numErrors);

			// Break from infinite loop
			return returnStatus; 

		} else if(returnStatus.code === CONFIG.DEV_CONFIG.FILE_READ_ERROR_CODE){
			// If excel file was unable to be read, abort
			numLastLinkErrors++;
			if(numLastLinkErrors > CONFIG.DEV_CONFIG.MAX_LINK_ERRORS){
				console.log('Unable to read file. Aborting.');
				throw "File can't be read!";
				break;
			}
		} else {
			// If any other error, restart the execution by saving the progress and 
			// restarting from the errored point.

			// Find out which parcel errored as the first parcel in the `remaining_info` 
			// returned by `runCycle`, which contains the information not yet processed
			let erroredParcel = returnStatus.remaining_info[0][CONFIG.DEV_CONFIG.PARCEL_IDX];
			
			// If link causes error more than once, count how many times the same link 
			// causes error
			if(erroredParcel === lastErroredParcel){
				numLastLinkErrors++;
				
			} else {
				numLastLinkErrors = 1;
			}
			
			// Set the starting point and continue the loop to run another cycle.
			lastErroredParcel = erroredParcel;
			remainingInfo = returnStatus.remaining_info;
			finalpath = returnStatus.finalpath;
			console.log('Failed. See above error. Trying again.');
		}
		// log error
		
	}
	
	
}
/**
	Runs one cycle of the scraping. Processes information until error occurs or program 
	completes.

	Args:
		infilepath - String. Input excel file path.

		remainingInfo - 2D Array. undefined if cycle is run for the first time, i.e.,
						program starting from the beginning, reading from `infilepath`. 
						Otherwise contains array of information that program still has to process.

		finalpath - String. undefined if cycle is run for the first time, i.e., there 
					is no Excel file already created. Otherwise, contains the path of the excel
					file the program has to append to.

		headless - boolean. true if program should scrape headlessly (no browser display). 
							false if browser display is desired

		numLastLinkErrors - int. The number of times the first row in `remainingInfo` caused
							an error

	Returns:

		return status object: 

		{
			code: execution codes definied in `config/dev_config.json`,
			remainingInfo: Array of information not yet processed, if above code is not successful
			finalpath: string of the path of the excel file that the program is writing to
		}
**/
async function runCycle(infilepath, remainingInfo, finalpath, headless, numLastLinkErrors){

	// Create new browser and new page.
	const browser = await puppeteer.launch({headless: headless});
	const page = await browser.newPage();

	const CONFIG = new ConfigReader();
	
	let excel = new ExcelWriter(0, 0);
	let worksheetInformation;

	// If there is remaining information not processed from a previous cycle, use that information
	if(remainingInfo !== undefined) worksheetInformation = remainingInfo;

	// Otherwise, read information array from excel file in `infilepath`
	else {
		try{
			worksheetInformation = await excel.readFile(infilepath);
			worksheetInformation = worksheetInformation.map(row => row.slice(1));
			worksheetInformation.shift();
		} catch(e){
			return {
				code: CONFIG.DEV_CONFIG.FILE_READ_ERROR_CODE,
				remaining_info: remainingInfo
			}
		}
	}
	
	// `updatedInformation` contains the 2D array of scraped information
	let updatedInformation = [];
	let lastCounty = worksheetInformation[0][CONFIG.DEV_CONFIG.COUNTY_IDX];

	// Loop through all rows of input excel array
	for(let i = 0; i < worksheetInformation.length; i++){

		let currentRow = worksheetInformation[i];

		// Some formatting and adjustments for accuracy of dates.
		// There were problems with some dates being read as strings, and some being read as date objects.
		// In the latter case, the date has to be incremented for accuracy.		
		if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "string" && currentRow[CONFIG.DEV_CONFIG.DATE_IDX].trim() !== ''){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX]));	
		} else if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "object"){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(DateHandler.incrementDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX])));
		}

		// Read the county String and format it
		let county = currentRow[CONFIG.DEV_CONFIG.COUNTY_IDX];
		if(county) county = county.toLowerCase().trim();

		// Check to see if this county should be skipped 
		let skipThisParcel = false;

		// Skip if county is neither in `LAYOUT_COUNTY_LIST` or `COUNTY_MAP`, OR if it is in `EXCLUDED_COUNTY_LIST`
		if( (!LAYOUT_COUNTY_LIST.includes(county) && !(county in COUNTY_MAP)) || EXCLUDED_COUNTY_LIST.includes(county) ) skipThisParcel = true;
		
		// Skipping county based on run type
		if(RUN_TYPE === 'all'){
			// no counties skipped
		} else if(RUN_TYPE === 'some'){

			// If you want to run only some particular counties, not used by client
			if( !TARGET_COUNTY_LIST.includes(county) ) skipThisParcel = true;
		} else if(RUN_TYPE === 'between'){

			// County should be alphabetically between `BETW_1` and `BETW_2`, otherwise skipped.
			if( !( (BETW_1.localeCompare(county) <= 0) && (BETW_2.localeCompare(county) >= 0) )) skipThisParcel = true;
		} else if(RUN_TYPE === 'one'){

			// County should be exactly the county in `ONE`, otherwise skipped
			if(ONE !== county) skipThisParcel = true;
		}
		
		// Not sure why this is defined here instead of in the else-block, but I don't want to mess with it
		let scrapedRow, comparisonArray;
		if(skipThisParcel) {
			continue; // Skip the county based on the above boolean criteria
		}

		else{
			// If this county uses the Scraper of another county
			if(county in COUNTY_MAP) county = COUNTY_MAP[county];

			// Get the Scraper module and instantiate the scraper
			let currentScraperType = SCRAPER_MAP[county];
			let currentScraper = new currentScraperType();

			// Get the URLs from the row of the excel sheet
			let propertyURL = currentRow[CONFIG.DEV_CONFIG.PROP_URL_IDX];
			let auditorURL = currentRow[CONFIG.DEV_CONFIG.AUDITOR_URL_IDX];

			// Get the Parcel ID # from the row of the excel sheet
			let parcelNum = currentRow[CONFIG.DEV_CONFIG.PARCEL_IDX];

			// In case the URL is a hyperlink object from Excel and not directly a string,
			// we want only the text portion of it.
			if(typeof propertyURL !== "string"){
				if(typeof propertyURL !== "undefined") propertyURL = propertyURL.text;
				else propertyURL = undefined;
			}
			currentRow[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;

			// Repeat extraction of string URL for auditor URL.
			if(typeof auditorURL !== "string"){
				if(typeof auditorURL !== "undefined") auditorURL = auditorURL.text;
				else auditorURL = undefined;
			}
			currentRow[CONFIG.DEV_CONFIG.AUDITOR_URL_IDX] = auditorURL;
			
			let scrapedInformation = {};

			// If this row caused an error too many times, we are just going to skip it.
			if(numLastLinkErrors === CONFIG.DEV_CONFIG.MAX_LINK_ERRORS){
				console.log(parcelNum + ' caused error more than ' + CONFIG.DEV_CONFIG.MAX_LINK_ERRORS + ' times. Skipping.');

				// Fill row with the string 'ERR'
				scrapedInformation.scraped_information = [parcelNum].concat(Array(10).fill('ERR'));
				scrapedInformation.scraped_information[CONFIG.DEV_CONFIG.COUNTY_IDX] = undefined;
				numErrors++;
				numLastLinkErrors = 1;
			}
			else {
				try{

					// First try invoking scraper using the Property URL
					scrapedInformation = await currentScraper.scrapeByPropertyURL(page, propertyURL);

					// If the property URL fails, try accessing the Auditor URL directly and searching by Parcel ID
					if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
						console.log('\nProperty URL Invalid. Attempting to access via Parcel Number')

						// If Parcel ID# is empty, return error
						if((''+parcelNum).trim() === '') {
							scrapedInformation  = {
								code: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
								scaped_information: []
							};
						}

						// Invoke Scraper using `auditorURL` and Parcel ID #
						else scrapedInformation = await currentScraper.scrapeByAuditorURL(page, auditorURL, ""+parcelNum, browser);
						
						// If error with auditor link as well,
						if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
							// Process some fatal error.
							console.log('Auditor URL Invalid. Aborting.')

							// Dump all of the information we already have to the target excel file
							if(updatedInformation.length > 0){
								finalpath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, finalpath);	
							}

							// Close the browser and return error code along with the path of the excel file written to and the
							// array of information that has not yet been processed.
							await browser.close();
					
							return {
								code: scrapedInformation.return_status,
								remaining_info: worksheetInformation.slice(i),
								finalpath: finalpath
							}
							
						}
					}

				// Any other errors encountered. Dump the information already processed and return remaining information not yet processed.
				} catch(e){
					console.log(e);
					if(updatedInformation.length > 0){
						finalpath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, finalpath);	
					}
					await browser.close();
					
					return {
						code: scrapedInformation.return_status,
						remaining_info: worksheetInformation.slice(i),
						finalpath: finalpath
					}

				}
				
			}

			// If we got this far, then there were no errors with scraping information for that row.
			// scrapedInformation.scraped_information will now have a 1D array containing new scraped information
			// for each column in the excel sheet and for the row corresponding to that one property.
			comparisonArray = [];
			scrapedRow = scrapedInformation.scraped_information;

			// Iterate through each element in the row
			for(let i = 0; i < currentRow.length; i++){
				
				// Replace anything that is undefined in the new information with the old information. Used for information that
				// does not change, for example, Parcel ID, County Name, some hyperlinks sometimes, etc.
				//
				// Also remove any confounding white-space characters and replace them with simple space ' '
				if(currentRow[i] !== undefined) currentRow[i] = (''+currentRow[i]).replace(/[\u000A\u00A0]|\s\s+/g,' ').trim();
				else currentRow[i] = '';
				if(scrapedRow[i] === undefined) scrapedRow[i] = currentRow[i];
				if(scrapedRow[i] !== undefined) scrapedRow[i] = (''+scrapedRow[i]).replace(/[\u000A\u00A0]|\s\s+/g,' ').trim();
				
				// Compare the new information with the old information
				comparisonArray.push(currentRow[i] === scrapedRow[i]);
			}
			
			// Convert 'true' and 'false' comparisons to 1s and 0s
			// This has as many elements as the columns of the excel sheet, and corresponds to
			// whether the information for a particular column in the current row has changed
			// (I.e., new information not equal to old information)
			comparisonArray = comparisonArray.map(b => b ? 0 : 1);
		}
		
		// Convert comparisonArray to strings and add it as a column to the output excel sheet.
		scrapedRow.push(comparisonArray.join(''));

		// Save to the updated information and continue.
		updatedInformation.push(scrapedRow);
	}
	
	// If we've made it this far, then we have reached the end of the information without errors,
	// and the program is successfully complete.

	// Write the remaining updatedInformation to the target excel file
	finalpath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, finalpath);

	// Close browser and change the target file name to indicate that the execution is complete.
	await browser.close();
	finalpath = excel.appendComplete(finalpath);

	// Return success
	return {
		code: CONFIG.DEV_CONFIG.SUCCESS_CODE,
		finalpath: finalpath
	};
	
}

// Headless is false by default. Change here if you don't want to see the browser display while the program is running.
run(CONFIG.USER_CONFIG.SOURCE_FILE,false);
module.exports = run;
