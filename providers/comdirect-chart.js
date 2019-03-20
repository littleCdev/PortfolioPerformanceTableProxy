let express = require('express');
let router = express.Router();

let request = require('request');
let cfg     = require("../config.json");

let SEARCHURL = "https://www.comdirect.de/inf/search/all.html?SEARCH_VALUE=%ISIN%";
let URL = "https://www.comdirect.de/inf/snippet$lsg.chart_map_middle.ajax?CHART_URL_PARAMS=%PARAMS%&REFERRER_PAGE_ID=lsg.bond.detail.chart";
let CHARTPARAMS = "WIDTH=645&HEIGHT=655&TYPE=MOUNTAIN&TIME_SPAN=SE&TO=%MAXTIME%&AXIS_SCALE=lin&PRICE_MAP=1&DATA_SCALE=abs&LNOTATIONS=%NOTATIONID%&LCOLORS=5F696E&IND0=VOLUME&AVGTYPE=simple&WITH_EARNINGS=1&SHOWHL=1";
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

function getIdNotation(isin,callback) {

    let sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    let req;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
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

        let regex = /ID_NOTATION=([0-9]{1,})"/gmi;
        let match = regex.exec(body);

        if(match === null || match[1] === undefined){
            callback("ERROR");
            return;
        }
        let notationid = match[1];
        console.log(notationid);

        regex = /id="timestamp_keyelement" value="([0-9]{1,})"/gmi;
        match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }

        let maxtime = match[1];
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

function getDataFromTable(res,notationId,maxtime,isPercent) {


    let params = CHARTPARAMS.replace(/%MAXTIME%/gi,maxtime).replace(/%NOTATIONID%/gi,notationId);
    let sUrl = URL.replace(/%PARAMS%/gi,encodeURIComponent(params));
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

        let sTableBody = "";
        let sHtml = body;
        let regex = /{"dateTime":"([0-9]{2}.[0-9]{2}.[0-9]{4})","text":"([0-9]{1,},[0-9]{2})"}/gim;
        let match = [];
        while (match = regex.exec(sHtml)) {
            let price = parseFloat(match[2].replace(/,/gi,"."));

            if(isPercent)
                price /= 100;

            sTableBody += ROW.replace(/%DATE%/ig,match[1]).replace(/%PRICE%/ig,price);

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

router.get('/isin/:ISIN', function (req, res) {
    getIdNotation(req.params.ISIN,function (err,notationId,time,isPercent) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId,time,isPercent);
    })

});


module.exports = router;