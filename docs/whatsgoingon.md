# What's going on?

This document will highlight how the application does everything mentioned in root/README.md

<h3> DISCLAIMER: </h3> The focus of this project for the short time I was working on it was progress and results (as software engineers typically focus on) and not necessarily code maintenance (as software engineers tend to neglect.) You may encounter some (read: a lot) of janky code that perhaps could be better written, but what is already present seems to work as it stands. 

<h3> What you need installed: </h3>

<ul>
  <li> <a href='https://nodejs.org/en/download/'> NodeJS </a> - <em>For the actual programming of the application. </em> </li>
  <li> <a href='https://www.chilkatsoft.com/downloads_ActiveX.asp'> Chilkat ActiveX Objects </a> - <em>To manipulate the configuration files with simple user interfaces</em> </li>
</ul>

<h3> How to install application: </h3>

<ol>
  <li> Install software mentioned above. </li>
  <li> Clone or download this repository to your desired location on your computer </li>
  <li> Run `npm install` from the command line in the main folder which has `package.json` in it </li>
  <li> Edit the path in `Run Audit.bat` to the path of the folder in which the application is installed </li>
  <li> Edit the input and output paths either manually in `config/dev_config.json` and `config/user_config.json` or using `EDIT_CONFIG.bat` </li>
  <li> Install the Custom Excel Add-ins `diff.xlam` and `cleardiff.xlam` in `src/macros/` following <a href='https://www.contextures.com/exceladdins.html'>these instructions</a>. </li>
</ol>

<h3> How to run application </h3>
<ol>
  <li> Perform above steps to install application. </li>
  <li> Double-click `Run Audit.bat` OR run `node index.js` from command line in main folder. </li>
</ol>
  
<h3>Application - what and how:</h3>

<ol>
  <li> Take and read base Excel file as input to the program
    <ul>
      <li> Read path of input file from config file `config/user_config.json` </li>
      <li> This (and other config reading activities) is done in the module `ConfigReader`, conveniently placed in `src/ConfigReader.js` </li>
      <li> ConfigReader uses standard JavaScript JSON library. </li>
    </ul>
  </li>
  <li>
    Read the Excel File row-by-row for each property
    <ul>
      <li> Uses the NodeJS package <a href='https://github.com/exceljs/exceljs'>exceljs</a> </li>
      <li> Excel reading occurs in module `ExcelWriter`, located in `src/ExcelWriter.js` (sorry for the poor naming, this module does both Excel reading and writing) </li>
    </ul>
  </li>
  <li>
    Visit the property page using the hyperlink(s) provided in the Excel row for that property
    <ul>
      <li> This is the biggest bulk of the application which will take the most time to get through / write anew. </li>
      <li> Uses the NodeJS package <a href='https://github.com/puppeteer/puppeteer'>puppeteer</a> </li>
      <li> All web-scraping occurs in files `src/[county_name]/Scraper.js`, with each of these files being the scraper for the respective county. </li>
    </ul>
  </li>
  <li>
    Read relevant property information from the property page
    <ul>
      <li> Also using puppeteer </li>
    </ul>
  </li>
  <li>
    Compare read information with information present in Excel sheet already. Mark any changes in information.
    <ul>
      <li> Simple equality relations of Strings of text. </li>
      <li> Write a string of 1s and 0s to extra column in extra sheet. n-th digit contains 0 if n-th column hasn't changed, 1 otherwise </li>
    </ul>
  </li>
  <li>
    Output new information and comparison results to new Excel file.
    <ul>
      <li> Changes in Excel sheet highlighted using Excel VBA Macros `diff.xlam` and `cleardiff.xlam` in `src/macros/` </li>
    </ul>
  </li>
</ol>

<h3> Folders and Descriptions </h3>

Each folder has its own [folder_name]info.md file. There you can get more information specific to the files in the folder. Below is a list of all the folders and their purposes.

<ul>
  <li>
    docs/ - <em>Information on how to navigate the folder</em>
  </li>
  <li>
    config/ - <em>Configuration files for the program</em>
  </li>
  <li>
    Excel/ - <em>Example input and output files</em>
  </li>
  <li>
    src - <em>All of the source code. Most important folder.</em>
  </li>
</ul>

<h3> Where to start digging? </h3>

Perhaps the best thing to do is first look at the `Excel/` folder to see the expected inputs and outputs. There is an example input file and an example output file. Keep in mind that the example output only shows one county, but the actual output would have to show all counties in the same file. 

Next you can see what the program does by running the program on the example input. A Chromium browser window should open that will show you what the program is doing, at least as far as web-scraping goes. 

The best place to start navigating through the code is the `src/` folder. This folder contains all of the source code. Start by reading the file `src/srcinfo.md`.

Then you can perhaps go through all folders and read the corresponding `[folder_name]info.md` files.



