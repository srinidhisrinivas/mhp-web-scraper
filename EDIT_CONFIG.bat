<!-- :: Batch section
@echo off
setlocal

echo Select an option:
for /F "delims=" %%a in ('mshta.exe "%~F0"') do set "HTAreply=%%a"
echo End of HTA window, reply: "%HTAreply%"
goto :EOF
-->


<HTML>
<HEAD>

<HTA:APPLICATION SCROLL="no" SYSMENU="no" >

<TITLE>Edit User Config</TITLE>
<SCRIPT language="JavaScript">
window.resizeTo(500,520);

function closeHTA(){
   window.close();
}

function ReadFile(){
	
   var JSON = new ActiveXObject("Chilkat_9_5_0.JsonObject");
	JSON.LoadFile("config/user_config.json");
   return JSON;
}
function load(){
   var JSON = ReadFile();
	document.getElementById("dir").value = JSON.StringOf("TARGET_DIR");
   document.getElementById("source").value = JSON.StringOf("SOURCE_FILE");
   document.getElementById("betw1").value = JSON.StringOf("BETW_1");
   document.getElementById("betw2").value = JSON.StringOf("BETW_2");
   document.getElementById("one").value = JSON.StringOf("ONE");
   var runtype = JSON.StringOf("RUN_TYPE");
   if(runtype === "all") document.getElementById("run-all").checked = true;
   else if(runtype === "between") document.getElementById("run-between").checked = true;
   else if(runtype === "one") document.getElementById("run-one").checked = true;

}

function stringToJarr(str){

   /**
   var arr = str.split(",");
   for(var i = 0; i < arr.length; i++){
      arr[i] = "\"" + arr[i] + "\"";
   }
   str = arr.join(",");
   **/
   var jarr = new ActiveXObject("Chilkat_9_5_0.JsonArray");
   if(str.charAt(0) !== "[") str = "[" + str + "]";
   jarr.Load(str);
   return jarr;
}

function restore(){
   var JSON = ReadFile();
   var defDir = JSON.StringOf("DEFAULT_TARGET_DIR");
   var defSrc = JSON.StringOf("DEFAULT_SOURCE_FILE");
   var defRun = JSON.StringOf("DEFAULT_RUN_TYPE");
   var defB1 = JSON.StringOf("DEFAULT_BETW_1");
   var defB2 = JSON.StringOf("DEFAULT_BETW_2");
   var defOne = JSON.StringOf("DEFAULT_ONE");

   JSON.UpdateString("TARGET_DIR", defDir);
   JSON.UpdateString("SOURCE_FILE", defSrc);
   JSON.UpdateString("RUN_TYPE", defRun);
   JSON.UpdateString("BETW_1", defB1);
   JSON.UpdateString("BETW_2", defB2);
   JSON.UpdateString("ONE", defOne);

   JSON.WriteFile("config/user_config.json");  
   closeHTA();
   return; 
}

function update(){
   var JSON = ReadFile();
   var FS = new ActiveXObject("Scripting.FileSystemObject");
   var dir = document.getElementById("dir").value;
   var source = document.getElementById("source").value;


   if(!FS.FolderExists(dir)){
      document.getElementById("dir-description").innerText = "ERROR: This folder does not exist";
   } else if(!FS.FileExists(source)){
      document.getElementById("source-description").innerText = "ERROR: This file does not exist";
   } else {
      var all = document.getElementById("run-all").checked;
      var betw = document.getElementById("run-between").checked;
      var one = document.getElementById("run-one").checked;

      var betw1 = document.getElementById("betw1").value.toLowerCase();
      var betw2 = document.getElementById("betw2").value.toLowerCase();

      var singleCounty = document.getElementById("one").value.toLowerCase();

      if(!(all || betw || one)){
         document.getElementById("sel-description").innerText = "ERROR: Select one of the following";
      } else if(betw && !(betw1 && betw2)){
         document.getElementById("sel-description").innerText = "ERROR: Enter county in both fields for Between";
      } else if(one && !singleCounty){
         document.getElementById("sel-description").innerText = "ERROR: Enter county for One"
      } else {
         document.getElementById("dir-description").innerText = "New Folder Saved!";
         document.getElementById("source-description").innerText = "New Source Saved!";
         document.getElementById("sel-description").innerText = "New Settings Saved!";


         JSON.UpdateString("TARGET_DIR", dir);
         JSON.UpdateString("SOURCE_FILE", source);

         if(all){
            JSON.UpdateString("RUN_TYPE", "all");
            JSON.UpdateString("BETW_1", "");
            JSON.UpdateString("BETW_2", "");
            JSON.UpdateString("ONE", "");
         } else if(betw) {
            JSON.UpdateString("RUN_TYPE", "between");
            JSON.UpdateString("BETW_1", betw1);
            JSON.UpdateString("BETW_2", betw2);
            JSON.UpdateString("ONE", "");
         } else if(one) {
            JSON.UpdateString("RUN_TYPE", "one");
            JSON.UpdateString("BETW_1", "");
            JSON.UpdateString("BETW_2", "");
            JSON.UpdateString("ONE", singleCounty);
         }
         
         JSON.WriteFile("config/user_config.json");  
         closeHTA();
 
      }
      
   }
   return;   
}

</SCRIPT>
</HEAD>
<BODY onload="load()">
	<div class="input-label" id="dir-label" style="font-weight: 400;"> Destination Folder: </div> <br>
   <input type="text" id="dir" style="width: 450px;"> <br>
   <div class="input-label" id="dir-description" style="font-size: 8pt;"> Copy and Paste the full path of the destination folder </div> <br>
   <div class="input-label" id="source-label" style="font-weight: 400;"> Source File: </div> <br>
   <input type="text" id="source" style="width: 450px;"> <br>
   <div class="input-label" id="source-description" style="font-size: 8pt;"> Copy and Paste the full path of the source file </div> <br>
   <div class="input-label" id="sel-label" style="font-weight: 400;"> Run On Counties: </div> <br>
   <div class="input-label" id="sel-description" style="font-size: 8pt;"> Select one of the following: </div> <br>
   <input type="radio" name="runtype" id="run-all" value="all"> <label for="all"> All </label>  <br><br>
   <input type="radio" name="runtype" id="run-between" value="between"> <label for="between"> Between </label>
   <input type="text" id="betw1" style="width: 80px;">
   <label> and </label>
   <input type="text" id="betw2" style="width: 80px;"> <br><br>
   <input type="radio" name="runtype" id="run-one" value="one"> <label for="one"> One: </label>
   <input type="text" id="one" style="width: 80px;"> <br><br>
   <button onclick="closeHTA();">Close</button>
   <button onclick="update();">Save</button>
   <button onclick="restore();">Restore Defaults </button>
</BODY>
</HTML>