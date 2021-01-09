const Excel = require('exceljs');
const ConfigReader = require('./ConfigReader.js');
const ERROR_LOGGER = require("./ErrorLogger.js");

let ExcelWriter = function(start, end){
	// Inputs start and end are not relevant to this project

	const CONFIG = new ConfigReader();

	this.writeToFile = async (filepath, information, finalpath) => {

		console.log(finalpath);
		const SHEET_NAME = 'Audit';

		// Create new excel workbook using `exceljs`
		let workbook = new Excel.Workbook();
		let sheet;
		
		// If `finalpath` is not passed, create a new excel sheet
		// Otherwise append to the excel sheet passed in `finalpath`
		
		if(finalpath === undefined){
			let currentDate = new Date();
			
			let filename = 'Audit' + '_' 
						+ currentDate.getFullYear()
						+ (currentDate.getMonth() < 9 ? '0' : '') + (currentDate.getMonth() + 1)
						+ (currentDate.getDate() < 10 ? '0' : '') + currentDate.getDate()
						+ '.xlsx';

			finalpath = filepath + '\\' + filename;
			sheet = workbook.addWorksheet(SHEET_NAME);

			// Define columns of excel sheet
			sheet.columns = [
				{header: 'Parcel Numbers', key: 'parcel', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Last Sale Date', key: 'date', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Last Sale Price', key: 'price', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Primary Contact: Company Name: Company Name', key: 'company', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Property: Company Name Per The Auditor', key: 'name', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Property: Company Address Per Auditor', key: 'address', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Mailing Tax Name', key: 'taxname', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Mailing Tax Address', key: 'taxaddress', style:{font: {name:'Calibri', size: 11}}},
				{header: 'County', key: 'county', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Direct Link to Property/Auditor', key: 'propertyURL', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Link to Auditors Website', key: 'auditorURL', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Changes Found', key: 'changes', style:{font: {name:'Calibri', size: 11}}}
			

			];
			
		} else {

			// If `finalpath` is passed in, read excel file present at that path
			await workbook.xlsx.readFile(finalpath);
			sheet = workbook.getWorksheet(SHEET_NAME);
		}
		
		// Iterate through each row of information
		for(let i = 0; i < information.length; i++){
			let row = information[i];

			// If any of the information is undefined, change it to empty string before writing
			row = row.map(info => { if(info === undefined) return ""; else return info; });
			
			let dataArray = row;
			
			// Add row to sheet
			sheet.addRow(dataArray);
		}

		// Write sheet to either the same path or the new path, stored in `finalpath`
		await workbook.xlsx.writeFile(finalpath);

		// Return what the path of the excel file is 
		return finalpath;
	}

	// Append some thing to the end of the filename before the extension
	let appendToFileName = function(filepath, appendage){
		let fileparts = filepath.split('\\');
		let filename = fileparts.pop();
		let filedir = fileparts.join('\\');

		let nameparts = filename.split('.');
		let name = nameparts[0];
		let ext = nameparts[1];

		name = name + appendage;

		return filedir + '\\' + name + '.' + ext;
	}

	// Append to the file to indicate completion of the program
	this.appendComplete = function(filepath){
		let newFilePath = appendToFileName(filepath, CONFIG.DEV_CONFIG.COMPLETE_APPEND);
		var fs = require('fs');
		fs.rename(filepath, newFilePath, function(err) {
		    if ( err ) console.log('ERROR: ' + err);
		});
		return newFilePath;
	}

	// Append to the file to indicate error in the program
	this.appendError = function(filepath){
		return appendToFileName(filepath, CONFIG.DEV_CONFIG.ERROR_APPEND);
	}

	// Read an excel file from a path and return as a 2D array of rows and columns
	this.readFile = async function(filepath){
		const workbook = new Excel.Workbook();
		await workbook.xlsx.readFile(filepath);
		let worksheet = workbook.worksheets[0];
		let worksheetArray = [];
		worksheet.eachRow(function(row, rowNumber){
			worksheetArray.push(row.values);
		});
		return worksheetArray
	}
}
module.exports = ExcelWriter;