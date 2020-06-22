let express = require('express');
let router = express.Router();

let formidable = require('formidable');
let papa        = require('papaparse');
let cfg         = require("../config.json");
let path        = require('path');
let fs          = require('fs');

router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    console.log(req.originalUrl);
    next();
});

function parseCSVFile(file,callback){
    let fd = fs.createReadStream(file.path);
    papa.parse(fd, {
        delimiter: ";",
        skipEmptyLines: true,
        complete: function(results) {
            fd.close();

            /*
            [ 'Buchungstag',
               'Gesch�ftstag',
               'St�ck / Nom.',
               'Bezeichnung',
               'WKN',
               'W�hrung',
               'Ausf�hrungskurs',
               'Umsatz in EUR',
               '' ],
             */

            var CVS = results.data;
            CVS = CVS.splice(3); // remove first 3 lines, they are garbage

            callback(null,CVS);
        },
        error: function(err, file, inputElem, reason)
        {
            fd.close();
            callback(reason);
        }
    });


}

function alterCVS(CSV,res){
    /*
    0 -> Buchungstag
    1 -> Geschäftstag
    2 -> Stück / Nom.
    3 -> Bezeichnung
    4 -> WKN
    5 -> Währung
    6 -> Ausführungskurs
    7 -> Umsatz in EUR
    8 -> (NEW) Gebühren (Umsatz - (Stück*Ausführungskurs))
    9 -> (NEW) Typ (kauf|verkauf)

     */

    for(let i=0;i<CSV.length;i++){
        let iParts = parseFloat(CSV[i][2].replace(",","."));
        let iAmount = parseFloat(CSV[i][7].replace(",","."));
        let iPrice = parseFloat(CSV[i][6].replace(",","."));

        if(iAmount < 0) {
            CSV[i][9] = "verkauf";
            iAmount *= -1;
        }else
            CSV[i][9] = "kauf";



        let iDiff = iAmount - (iParts * iPrice);

        CSV[i][8] = iDiff.toFixed(2).replace(".",",");

        console.log("parts\t"+iParts+ "\tAmount\t"+iAmount+"\tprice\t"+iPrice+"\tdiff:\t"+iDiff);
    }

    let aFirstRow = [
        "Buchungstag",
        "Geschäftstag",
        "Stück / Nom.",
        "Bezeichnung",
        "WKN",
        "Währung",
        "Ausführungskurs",
        "Umsatz in EUR",
        "Gebühren",
        "Typ"
    ];

    CSV.splice(0,0,aFirstRow);


    let CSVstring = papa.unparse(CSV);
    res.setHeader('Content-disposition', 'attachment; filename=' + "comdirect-csv-export.csv");
    res.setHeader('Content-type', "text/comma-separated-values");
    res.send(CSVstring);
}

router.get('/', function (req, res) {
    res.sendFile("comdirect.html", { root: path.join(__dirname, '../converters/') });
});

router.get('/download/PPP-comdirect-export.json', function (req, res) {
    res.setHeader('Content-disposition', 'attachment; filename=' + "PPP-comdirect-export.json");
    res.setHeader('Content-type', "application/json");
    res.sendFile("PPP-comdirect-export.json", { root: path.join(__dirname, '../converters/') });
});


router.post('/', function (req, res) {
    new formidable.IncomingForm().parse(req, (err, fields, files) => {
        if (err) {
            console.error('Error', err);
            throw err
        }
        console.log('Fields', fields);
        console.log('Files', files);

        if(files["csv-export"]!==undefined) {
            parseCSVFile(files["csv-export"], function (e, data) {
                if (e !== null) {
                    res.send(e);
                    return;
                }
                alterCVS(data,res);
            });
        }
    });
});

module.exports = router;