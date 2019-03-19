let request = require('request');
let dateformat  = require('dateformat');
let papa        = require('papaparse');
let cfg     = require("../config.json");

let SEARCHURL = "https://www.comdirect.de/inf/search/all.html?SEARCH_VALUE=%ISIN%";
let URL = "https://kunde.comdirect.de/inf/kursdaten/historic.csv?INTERVALL=16&DATETIME_TZ_END_RANGE_FORMATED=%DATE%&WITH_EARNINGS=false&DATETIME_TZ_START_RANGE_FORMATED=01.01.1970&ID_NOTATION=%NOTATIONID%";

let TABLE = "<table>\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th>Datum</th>\n" +
    "            <th>Close</th>\n" +
    "            <th>Tageshoch</th>\n" +
    "            <th>Tagestief</th>\n" +
    "            <th>Schluss</th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        %BODY%\n" +
    "    </tbody>\n" +
    "</table>";

let ROW = "<tr>" +
    "<td>%DATE%</td>" +
    "<td>%CLOSE%</td>" +
    "<td>%HIGH%</td>" +
    "<td>%LOW%</td>" +
    "<td>%END%</td>" +
    "</tr>";

function getIdNotation(isin,callback) {

    var sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    var req;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        var proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }
console.log(sUrl);
    req.get(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR");
            return;
        }

        var regex = /ID_NOTATION=([0-9]{1,})"/gmi;
        var match = regex.exec(body);

        if(match === null || match[1] === undefined){
            callback("ERROR");
            return;
        }
        var notationid = match[1];
        console.log(notationid);

        regex = /id="timestamp_keyelement" value="([0-9]{1,})"/gmi;
        match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }

        var maxtime = match[1];
        maxtime = maxtime.substr(0,10);

        console.log("maxtime: "+maxtime);


        regex = /<span class="text-size--medium outer-spacing--xxsmall-left outer-spacing--small-top">(.+)<\/span>/gmi;
        match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }

        if(match[1] === "%") {
            console.log("is percent");
            callback(null, notationid, maxtime, true);
        }else
            callback(null,notationid,maxtime,false);




    });
}

function getDataFromTable(res,notationId,isPercent) {
    let sToday = dateformat(new Date(),"dd.mm.yyyy");
    let sUrl = URL.replace(/%NOTATIONID%/gi,notationId).replace(/%DATE%/gi,sToday)
    console.log(sUrl);

    let req;
    if(cfg.proxy.useproxy){
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }

    req(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response.statusCode !== 200){
            res.send("ERROR");
            return;
        }


        let oCSV = papa.parse(body);
        oCSV.data.splice(0,3); //removes headers
        /*
        0->Datum
        1->Eröffnung
        2->Hoch
        3->Tief
        4->Schluss
        5->Volumen
         */
        let sTableBody = "";
        console.log(oCSV);
        for(let i=0; i<oCSV.data.length;i++){
            if(i===0) continue;
            sTableBody += ROW
                .replace(/%DATE%/ig,oCSV.data[i][0])
                .replace(/%HIGH%/ig,oCSV.data[i][2])
                .replace(/%LOW%/ig,oCSV.data[i][3])
                .replace(/%LOW%/ig,oCSV.data[i][3])
                .replace(/%CLOSE%/ig,oCSV.data[i][4]);
        }
        let table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);
    });

}

exports.getCreateTable = function (res,isin) {

    getIdNotation(isin,function (err,notationId,time,isPercent) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId,time,isPercent);
    })
};

