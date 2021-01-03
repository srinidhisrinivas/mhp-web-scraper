#Excel Files

<h3> What the input contains: </h3>

<ul>
  <li> Each row corresponds to a property </li>
  <li> The first column, 'Parcel Numbers' contains a uniquely identifying ID for each property. You will use this sometimes to search for properties on the Auditors' websites while collecting information. </li>
  <li> The next two columns are the latest sales data for the property. When this changes, that typically means a property has been transferred and the program has to detect this. </li>
  <li> The next four columns are the owner information as found on the Auditor's website. </li>
  <li> The next column contains the name of the county to which the property belongs to. It is better to start with the excel file sorted by county. </li>
  <li> The last two columns contain hyperlinks. The first link is the direct link to the property page where the information should be collected from. If the first link does not work, the program uses the second link to go directly to the Auditor's property search page and uses the Parcel ID to search for the property. </li>
</ul>  

<h3> What the output contains: </h3>
<ul>
  <li> Same columns as above, but populated with the information collected directly from the auditor's website. </li>
  <li> An extra column with a string of 1s and 0s. A 1 in the n-th position of the string means that the information in column n in the output is not the same as the information in the same column in the input file. </li>
  <li> Run the Macros `diff.xlam` and `cleardiff.xlam` (Installation instructions in `docs/whatsgoingon.md`) to see how the differences are highlighted using this last column. </li>
</ul>

 <h3> DISCLAIMER: </h3> Information in these files are not up to date. These files are from some time in August 2020, so the information on the Auditor's website may have since changed. 
