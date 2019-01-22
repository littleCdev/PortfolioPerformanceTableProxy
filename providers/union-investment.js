var request     = require('request');
var dateformat  = require('dateformat');
var papa        = require('papaparse');
var cfg         = require("../config.json");

var CSVURL = "https://www.union-investment.de/handle";
var TABLE = "<table>\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th>Datum</th>\n" +
    "            <th>Close</th>\n" +
    "            <th>Tageshoch</th>\n" +
    "            <th>Tagestief</th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        %BODY%\n" +
    "    </tbody>\n" +
    "</table>";

var ROW = "<tr>" +
    "<td>%DATE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "</tr>";


function getCSV(isin,callback) {

    var sToday = dateformat(new Date(),"dd.mm.yyyy");

    var req;
    if(cfg.proxy.useproxy){
        var proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }
    req.post(CSVURL,{
        form:{
            "generate": true,
            "action": "doDownloadSearch",
            "start_time": "01.01.2016",
            "end_time": sToday,
            "csvformat": "us",
            "choose_indi_fondsnames": isin,
            "choose_all_fondsnames": isin
        }
    }, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if (response.statusCode !== 200) {
            callback("ERROR");
            return;
        }
        if (body.toLowerCase().indexOf("<head>") > -1){
            callback("invalid ISIN");
            return;
        }
       callback(null,body);
    });
}

function createTableFromCSV(csv,res){
    var oCVS = papa.parse(csv);
    var sTableBody = "";
/*
   [ [ 'Name',
       'ISIN',
       'Waehrung',
       'Ausgabepreis',
       'Ruecknahmepreis',
       'Ausgabeaufschlag',
       'Datum',
       'Aktiengewinn EStG in %',
       'Aktiengewinn KStG in %',
       'Zwischengewinn (Ertragsausgleich wurde durchgef�hrt)',
       'Immobiliengewinn in %',
       'TIS' ],
 */

    for(var i=0; i<oCVS.data.length;i++){
        if(i===0) continue;
        sTableBody += ROW.replace(/%DATE%/ig,oCVS.data[i][6]).replace(/%PRICE%/ig,oCVS.data[i][4]);
    }
    var table = TABLE.replace(/%BODY%/ig,sTableBody);

    res.send(table);

}

exports.getCreateTable = function (res,isin) {

   getCSV(isin,function (err,data) {
       if(err !== null){
           res.send("ERROR");
           return;
       }
       createTableFromCSV(data,res);
   })
};

