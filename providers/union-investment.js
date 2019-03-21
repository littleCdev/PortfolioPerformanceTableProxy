let express = require('express');
let router = express.Router();

let request     = require('request');
let dateformat  = require('dateformat');
let papa        = require('papaparse');
let cfg         = require("../config.json");
let path        = require('path');

let CSVURL = "https://www.union-investment.de/handle";
let TABLE = "<table>\n" +
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

let ROW = "<tr>" +
    "<td>%DATE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "</tr>";


function getCSV(isin,callback) {

    let sToday = dateformat(new Date(),"dd.mm.yyyy");

    let req;
    if(cfg.proxy.useproxy){
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }
    console.log("url (post):"+CSVURL);
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
            callback("ERROR invalid statuscode");
            return;
        }
        if (body.toLowerCase().indexOf("<head>") > -1){
            callback("invalid ISIN/ISIN does not exist");
            return;
        }
       callback(null,body);
    });
}

function createTableFromCSV(csv,res){
    let oCVS = papa.parse(csv);
    let sTableBody = "";
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

    for(let i=0; i<oCVS.data.length;i++){
        if(i===0) continue;
        sTableBody += ROW.replace(/%DATE%/ig,oCVS.data[i][6]).replace(/%PRICE%/ig,oCVS.data[i][4]);
    }
    let table = TABLE.replace(/%BODY%/ig,sTableBody);

    res.send(table);

}

router.get('/isin/:ISIN', function (req, res) {
    getCSV(req.params.ISIN,function (err,data) {
        if(err !== null){
            console.log(err);
            res.send(err);
            return;
        }
        createTableFromCSV(data,res);
    })
});

router.get('/', function (req, res) {
    res.sendFile("union-investment.html", { root: path.join(__dirname, '') });
});

module.exports = router;
