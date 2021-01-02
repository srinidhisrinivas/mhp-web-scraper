# mhp-web-scraper

<h3>Overview:</h3>

Use NodeJS Puppeteer headless browsing module to automate information collection from Ohio County Auditors' Websites and output to Excel in the desired format. The purpose is to compare latest information present online with information already present in client's database to detect changes in property sales/updates.

<h3>What the MHPScraper Application does:</h3>

<ol>
  <li> Take and read base Excel file as input to the program
    <ul>
      <li> This Excel file contains rows of information about properties all over Ohio (about 1,200).</li>
      <li> The columns contain: Property Parcel ID (Unique Identifier for Property), Sales Information, Property Owner Information, County, Hyperlinks to Property Page </li>
      <li> This file is typically generated automatically with information from Client's database and is given to program as input. </li>
    </ul>
  </li>
  <li>
    Read the Excel File row-by-row for each property
  </li>
  <li>
    Visit the property page using the hyperlink(s) provided in the Excel row for that property
  </li>
  <li>
    Read relevant property information from the property page
  </li>
  <li>
    Compare read information with information present in Excel sheet already. Mark any changes in information.
  </li>
  <li>
    Output new information and comparison results to new Excel file.
  </li>
</ol>

Visit docs/whatsgoingon.md for detailed information about how the application does all of these things.
