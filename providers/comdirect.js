let express     = require('express');
let router      = express.Router();

let request     = require('request');
let dateformat  = require('dateformat');
let papa        = require('papaparse');
let path        = require('path');
let cfg         = require("../config.json");

let SEARCHURL = "https://www.comdirect.de/inf/search/all.html?SEARCH_VALUE=%ISIN%";
let URL = "https://kunde.comdirect.de/inf/kursdaten/historic.csv?INTERVALL=16&DATETIME_TZ_END_RANGE_FORMATED=%DATE%&WITH_EARNINGS=false&DATETIME_TZ_START_RANGE_FORMATED=01.01.1970&ID_NOTATION=%NOTATIONID%";

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
    "<td>%CLOSE%</td>" +
    "<td>%HIGH%</td>" +
    "<td>%LOW%</td>" +
    "</tr>";

let COLLECTION_ITEM = "<li class=\"collection-item avatar\">\n" +
    "      <span class=\"title\">%MARKET%</span>\n" +
    "      <p>%URL%<br>\n" +
    "      </p>\n" +
    " <a href=\"%URL%\" class=\"secondary-content copyurl\"><i class=\"material-icons\" title='copy link to clipboard'>file_copy</i></a>" +
    "    </li>";
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
        let notationid = match[1];
        console.log("notationid: "+notationid);

        // get current price and date, will be added to csv values in case market isn't closed yet
        let currentData = {
            price:-1,
            date:""
        };
        regex = /<td class="table__column--top table__column--right" data-label="Datum">([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td>/gmi;
        match = regex.exec(body);
        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }
        currentData.date = match[1];
        currentData.date = currentData.date.substr(0,6)+dateformat(new Date(),"yyyy");
        console.log("currentData.date: "+currentData.date);


        regex = /<span class="realtime-indicator--value text-size--xxlarge text-weight--medium">[\s ]+([0-9]+,[0-9]+)[\s ]+<\/span>/gmi;
        match = regex.exec(body);
        if(match == null || match[1] ===undefined){
            callback("ERROR");
            return;
        }
        currentData.price = match[1];
        console.log("currentData.price: "+currentData.price);

        callback(null,notationid,currentData);
/*
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
*/



    });
}


function getDataFromTable(res,notationId,currentData) {
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


        let oCSV = papa.parse(body,{
            skipEmptyLines:true
        });

        oCSV.data.splice(0,2); //removes headers
        /*
        0->Datum
        1->Eröffnung
        2->Hoch
        3->Tief
        4->Schluss
        5->Volumen
         */
        let sTableBody = "";
        let bCurrentDataFound = false;
 //       console.log(oCSV);
        for(let i=0; i<oCSV.data.length;i++){
            if(oCSV.data[i][0] === currentData.date){
                console.log("Date found!");
                bCurrentDataFound = true;
            }

            sTableBody += ROW
                .replace(/%DATE%/ig,oCSV.data[i][0])
                .replace(/%HIGH%/ig,oCSV.data[i][2])
                .replace(/%LOW%/ig,oCSV.data[i][3])
                .replace(/%CLOSE%/ig,oCSV.data[i][4]);
        }


        if(!bCurrentDataFound && currentData.date !== "0"){
            sTableBody = ROW
                .replace(/%DATE%/ig,currentData.date)
                .replace(/%HIGH%/ig,currentData.price)
                .replace(/%LOW%/ig,currentData.price)
                .replace(/%CLOSE%/ig,currentData.price)
            +sTableBody;
        }

        let table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);
    });

}


router.get('/getnotation-id/:ISIN',function (req,res) {

    let isin = req.params.ISIN;

    let sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    let xhrreq;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        xhrreq = request.defaults({'proxy': proxyUrl});
    }else {
        xhrreq = request;
    }
console.log(sUrl);
    xhrreq.get(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR");
            return;
        }

        let regex = /<option value=\"([0-9]{9})\" .+label=\"(.+)\">(.+)<\/option/gmi;

        let match;
        let list = "";
        let url = req.get('host')+"/tables/comdirect/notationid/";
        while ((match = regex.exec(body)) != null) {
            console.log(match[1]+"\t"+match[2]);
            list += COLLECTION_ITEM
                .replace(/%MARKET%/gmi,match[2])
                .replace(/%URL%/gmi,url+match[1]);
        }

        res.send(list);

    });
});
router.get('/notationid/:NOTATIONID', function (req, res) {
    getDataFromTable(res,req.params.NOTATIONID,{date:"0",price:-1});
});

router.get('/isin/:ISIN', function (req, res) {
    getIdNotation(req.params.ISIN,function (err,notationId,time,isPercent) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId,time,isPercent);
    })

});

router.get('/', function (req, res) {
    res.sendFile("comdirect.html", { root: path.join(__dirname, '') });
});

router.get('/comdirect.html.js', function (req, res) {
    res.sendFile("comdirect.html.js", { root: path.join(__dirname, '') });
});


module.exports = router;