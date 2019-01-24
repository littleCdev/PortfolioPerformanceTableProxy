var request = require('request');
var cfg     = require("../config.json");

var SEARCHURL = "https://www.comdirect.de/inf/search/all.html?SEARCH_VALUE=%ISIN%";
var URL = "https://www.comdirect.de/inf/snippet$lsg.chart_map_middle.ajax?CHART_URL_PARAMS=%PARAMS%&REFERRER_PAGE_ID=lsg.bond.detail.chart";
var CHARTPARAMS = "WIDTH=645&HEIGHT=655&TYPE=MOUNTAIN&TIME_SPAN=SE&TO=%MAXTIME%&AXIS_SCALE=lin&PRICE_MAP=1&DATA_SCALE=abs&LNOTATIONS=%NOTATIONID%&LCOLORS=5F696E&IND0=VOLUME&AVGTYPE=simple&WITH_EARNINGS=1&SHOWHL=1";
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
        var match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }

        var maxtime = match[1];
        maxtime = maxtime.substr(0,10);

        console.log("maxtime: "+maxtime);
        callback(null,notationid,maxtime);

    });
}

function getDataFromTable(res,notationId,maxtime) {


    var params = CHARTPARAMS.replace(/%MAXTIME%/gi,maxtime).replace(/%NOTATIONID%/gi,notationId);
    var sUrl = URL.replace(/%PARAMS%/gi,encodeURIComponent(params));
    console.log(sUrl);
    var req;
    if(cfg.proxy.useproxy){
        var proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
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

        var sTableBody = "";
        var sHtml = body;
        var regex = /{"dateTime":"([0-9]{2}.[0-9]{2}.[0-9]{4})","text":"([0-9]{1,},[0-9]{2})"}/gim;
        var match = [];
        while (match = regex.exec(sHtml)) {
            sTableBody += ROW.replace(/%DATE%/ig,match[1]).replace(/%PRICE%/ig,match[2]);
        }
        var table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);

    });

}

exports.getCreateTable = function (res,isin) {

    getIdNotation(isin,function (err,notationId,time) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId,time);
    })
};

