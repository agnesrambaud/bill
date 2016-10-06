"use strict";

var fs = require('fs'),
        csv = require('csv'),
        _ = require('lodash'),
        moment = require('moment'),
        async = require('async');


var Dict = INCLUDE('dict');
var Latex = INCLUDE('latex');

exports.install = function () {

    var object = new Object();
    F.route('/erp/api/bill', object.read, ['authorize']);
    F.route('/erp/api/bill/dt', object.readDT, ['post', 'authorize']);
    F.route('/erp/api/bill/ca', object.ca, ['authorize']);
    F.route('/erp/api/bill/pdf/', object.pdfAll, ['authorize']);
    F.route('/erp/api/bill/{id}', object.show, ['authorize']);
    F.route('/erp/api/bill', object.create, ['post', 'json', 'authorize']);
    F.route('/erp/api/bill/{id}', object.clone, ['post', 'json', 'authorize']);
    F.route('/erp/api/bill/accounting', object.exportAccounting, ['put', 'json', 'authorize']);
    F.route('/erp/api/bill/{id}', object.update, ['put', 'json', 'authorize']);
    F.route('/erp/api/bill/{id}', object.destroy, ['delete', 'authorize']);
    F.route('/erp/api/bill/pdf/{id}', object.pdf, ['authorize']);
    F.route('/erp/api/bill/releveFacture/pdf/{societeId}', object.releve_facture, ['authorize']);
    F.route('/erp/api/bill/download/{:id}', object.download);
};

/*	// list for autocomplete
 app.post('/api/bill/autocomplete', function (req, res) {
 
 var BillModel = MODEL('bill').Schema;
 
 console.dir(req.body.filter);
 if (req.body.filter == null)
 return res.send(200, {});
 var query = {
 "$or": [
 {name: new RegExp(req.body.filter.filters[0].value, "i")},
 {ref: new RegExp(req.body.filter.filters[0].value, "i")}
 ]
 };
 if (req.query.fournisseur) {
 query.fournisseur = req.query.fournisseur;
 } else // customer Only
 query.Status = {"$nin": ["ST_NO", "ST_NEVER"]};
 console.log(query);
 BillModel.find(query, {}, {limit: req.body.take}, function (err, docs) {
 if (err) {
 console.log("err : /api/bill/autocomplete");
 console.log(err);
 return;
 }
 
 var result = [];
 if (docs !== null)
 for (var i in docs) {
 //console.log(docs[i].ref);
 result[i] = {};
 result[i].name = docs[i].name;
 result[i].id = docs[i]._id;
 if (docs[i].cptBilling.id == null) {
 result[i].cptBilling = {};
 result[i].cptBilling.name = docs[i].name;
 result[i].cptBilling.id = docs[i]._id;
 } else
 result[i].cptBilling = docs[i].cptBilling;
 if (docs[i].price_level)
 result[i].price_level = docs[i].price_level;
 else
 result[i].price_level = "BASE";
 // add address
 result[i].address = {};
 result[i].address.name = docs[i].name;
 result[i].address.address = docs[i].address;
 result[i].address.zip = docs[i].zip;
 result[i].address.town = docs[i].town;
 result[i].address.country = docs[i].country;
 }
 
 return res.send(200, result);
 });
 });
 app.param('billId', object.bill);
 //other routes..
 };*/

function Object() {
}

// Read an offer
function Bill(id, cb) {
    var BillModel = MODEL('bill').Schema;

    var self = this;

    //TODO Check ACL here
    var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");
    var query = {};

    if (checkForHexRegExp.test(id))
        query = {
            _id: id
        };
    else
        query = {
            ref: id
        };

    //console.log(query);

    BillModel.findOne(query, "-latex")
            .populate("orders", "ref ref_client total_ht client")
            .populate("deliveries", "ref ref_client total_ht client")
            .populate("contacts", "firstname lastname phone email")
            .exec(cb);
}

Object.prototype = {
    read: function () {
        var BillModel = MODEL('bill').Schema;
        var self = this;

        var query = {};
        if (self.query) {
            for (var i in self.query) {
                if (i == "query") {
                    switch (self.query.query) {
                        case "WAIT" :
                            query.Status = {"$nin": ["PAID", "CANCELLED"]};
                            break;
                        default :
                            break;
                    }
                } else
                    query[i] = self.query[i];
            }
        }

        //console.log(self.query);

        BillModel.find(query, "-history -files -latex", function (err, doc) {
            if (err) {
                console.log(err);
                self.json({
                    notify: {
                        type: "error",
                        message: err
                    }
                });
                return;
            }

            //console.log(doc);

            self.json(doc);
        });
    },
    show: function (id) {
        var self = this;
        Bill(id, function (err, bill) {
            if (err)
                console.log(err);

            self.json(bill);
        });
    },
    create: function () {
        var BillModel = MODEL('bill').Schema;
        var self = this;

        var bill = {};
        bill = new BillModel(self.body);

        bill.author = {};
        bill.author.id = self.user._id;
        bill.author.name = self.user.name;

        //console.log(delivery);
        bill.save(function (err, doc) {
            if (err) {
                return console.log(err);
            }

            self.json(doc);
        });
    },
    clone: function (id) {
        var self = this;
        var BillModel = MODEL('bill').Schema;

        Bill(id, function (err, doc) {
            var bill = doc.toObject();

            //console.log(doc);

            delete bill._id;
            delete bill.__v;
            delete bill.ref;
            delete bill.createdAt;
            delete bill.updatedAt;
            delete bill.history;
            delete bill.total_paid;
            bill.Status = "DRAFT";
            bill.notes = [];
            bill.latex = {};
            bill.datec = new Date();
            bill.journalId = [];

            bill = new BillModel(bill);

            bill.author = {};
            bill.author.id = self.user._id;
            bill.author.name = self.user.name;

            if (bill.entity == null)
                bill.entity = self.user.entity;

            //console.log(delivery);
            bill.save(function (err, doc) {
                if (err) {
                    return console.log(err);
                }

                self.json(doc);
            });
        });
    },
    update: function (id) {
        var BillModel = MODEL('bill').Schema;
        var ProductModel = MODEL('product').Schema;
        //console.log("update");
        var self = this;

        //console.log(self.query);

        BillModel.findOne({_id: id}, "-latex")
                .populate("client.id", "name code_compta")
                .populate("orders", "ref ref_client total_ht client")
                .populate("deliveries", "ref ref_client total_ht client")
                .populate("contacts", "firstname lastname phone email")
                .exec(function (err, bill) {
                    //console.log(bill);
                    //console.log(req.body);
                    if (err) {
                        console.log(err);
                        return  self.json({errorNotify: {
                                title: 'Erreur',
                                message: err
                            }
                        });
                    }

                    bill = _.extend(bill, self.body);

                    bill.save(function (err, doc) {
                        if (err) {
                            console.log(err);
                            return self.json({errorNotify: {
                                    title: 'Erreur',
                                    message: err
                                }
                            });
                        }

                        //console.log(doc);
                        doc = doc.toObject();
                        doc.successNotify = {
                            title: "Success",
                            message: "Facture enregistree"
                        };
                        self.json(doc);
                    });
                });
    },
    destroy: function (id) {
        var BillModel = MODEL('bill').Schema;
        var self = this;

        BillModel.remove({
            _id: id
        }, function (err) {
            if (err) {
                self.throw500(err);
            } else {
                self.json({});
            }
        });
    },
    destroyList: function () {
        var BillModel = MODEL('bill').Schema;
        var self = this;

        if (!this.query.id)
            return self.throw500("No ids in destroy list");

        //var list = JSON.parse(this.query.id);
        var list = this.query.id;
        if (!list)
            return self.throw500("No ids in destroy list");

        var ids = [];

        if (typeof list === 'object')
            ids = list;
        else
            ids.push(list);

        BillModel.remove({
            _id: {$in: ids}
        }, function (err) {
            if (err) {
                self.throw500(err);
            } else {
                self.json({});
            }
        });
    },
    exportAccounting: function () {
        var BillModel = MODEL('bill').Schema;
        var ProductModel = MODEL('product').Schema;
        //console.log("update");
        var self = this;

        //console.log(self.query);

        var ids = self.body.id;
        if (!ids)
            return self.json({errorNotify: {
                    title: 'Erreur',
                    message: "No Id"
                }
            });
        if (typeof ids === 'string')
            ids = [ids];

        //console.log(ids);

        async.each(ids, function (id, callback) {

            BillModel.findOne({_id: id}, "-latex")
                    .populate("client.id", "name code_compta")
                    .populate("orders", "ref ref_client total_ht client")
                    .populate("deliveries", "ref ref_client total_ht client")
                    .exec(function (err, bill) {
                        //console.log(bill);
                        //console.log(req.body);

                        if (err)
                            return callback(err);

                        //already exported
                        if ((bill.Status !== 'NOT_PAID' && bill.Status !== 'VALIDATED') || bill.journalId.length > 0)
                            return callback(null);

                        var tva_code_collec = {};
                        var tva_code_deduc = {};

                        async.waterfall([
                            function (cb) {

                                Dict.dict({dictName: "fk_tva", object: true}, function (err, docs) {
                                    for (var i = 0; i < docs.values.length; i++) {
                                        if (docs.values[i].pays_code === 'FR' && docs.values[i].enable) {
                                            tva_code_collec[docs.values[i].value] = docs.values[i].code_compta_colle;
                                            tva_code_deduc[docs.values[i].value] = docs.values[i].code_compta_deduc;
                                            //console.log(docs.values[i]);
                                        }
                                    }
                                    cb(err);
                                });
                            },
                            function (cb) {

                                // TODO Notify
                                // TODO Add accounting
                                var Book = INCLUDE('accounting').Book;
                                var myBook = new Book();
                                myBook.setEntity(bill.entity);
                                myBook.setName('VTE');

                                // You can specify a Date object as the second argument in the book.entry() method if you want the transaction to be for a different date than today
                                var entry = myBook.entry(bill.client.name, bill.datec, {id: self.user._id, name: self.user.name}) // libelle, date
                                        .setSeq(parseInt(bill.ref.substring(bill.ref.length - 6, bill.ref.length), 10)); // numero de piece

                                // Add amount to client account
                                if (bill.total_ttc >= 0)
                                    entry.debit(bill.client.id.code_compta, bill.total_ttc, {
                                        societeName: bill.client.name,
                                        societeId: bill.client.id._id,
                                        billId: bill._id,
                                        billRef: bill.ref
                                    });
                                else
                                    entry.credit(bill.client.id.code_compta, Math.abs(bill.total_ttc), {
                                        societeName: bill.client.name,
                                        societeId: bill.client.id._id,
                                        billId: bill._id,
                                        billRef: bill.ref
                                    });

                                //Add transport
                                if (bill.shipping.total_ht > 0)
                                    entry.credit('624200', bill.shipping.total_ht, {label: 'TRANSPORT'});
                                else if (bill.shipping.total_ht < 0)
                                    entry.credit('624200', Math.abs(bill.shipping.total_ht), {label: 'TRANSPORT'});

                                cb(null, entry);
                            },
                            function (entry, cb) {

                                // Add product lines
                                // compact product lines

                                var productLines = _.compact(_.map(bill.lines, function (line) {
                                    if (!line.product.id)
                                        return null;

                                    return {
                                        id: line.product.id.toString(),
                                        //name: line.product.name,
                                        total_ht: line.total_ht
                                    }
                                }));

                                var out = {};
                                for (var i = 0, len = productLines.length; i < len; i++) {
                                    if (out[productLines[i].id])
                                        out[productLines[i].id].total_ht += productLines[i].total_ht;
                                    else
                                        out[productLines[i].id] = {
                                            id: productLines[i].id,
                                            total_ht: productLines[i].total_ht
                                        };
                                }

                                var arr = _.values(out); // convert object to array
                                //console.log(productLines, arr);

                                async.each(arr, function (lineBill, callback) {
                                    ProductModel.findOne({_id: lineBill.id}, "ref compta_sell", function (err, product) {
                                        //console.log(product);

                                        if (!product)
                                            return callback("Error product " + lineBill.name + " does not exist !");

                                        if (lineBill.total_ht > 0)
                                            entry.credit(product.compta_sell, lineBill.total_ht, {
                                                productId: product._id,
                                                productRef: product.ref
                                            });
                                        else
                                            entry.debit(product.compta_sell, Math.abs(lineBill.total_ht), {
                                                productId: product._id,
                                                productRef: product.ref
                                            });

                                        callback(err);
                                    });
                                }, function (err) {

                                    //lignes TVA
                                    for (var i = 0; i < bill.total_tva.length; i++) {
                                        //console.log(bill.total_tva[i]);

                                        //No tva
                                        if (bill.total_tva[i].total == 0)
                                            continue;

                                        if (!tva_code_collec[bill.total_tva[i].tva_tx])
                                            console.log("Compta TVA inconnu : " + bill.total_tva[i].tva_tx);

                                        if (bill.total_tva[i].total > 0)
                                            entry.credit(tva_code_collec[bill.total_tva[i].tva_tx], bill.total_tva[i].total, {
                                                tva_tx: bill.total_tva[i].tva_tx
                                            });
                                        else
                                            entry.debit(tva_code_collec[bill.total_tva[i].tva_tx], Math.abs(bill.total_tva[i].total), {
                                                tva_tx: bill.total_tva[i].tva_tx
                                            });

                                    }
                                    cb(err, entry);
                                });
                            },
                            function (entry, cb) {
                                //console.log(entry);

                                entry.commit()
                                        .then(function (journal) {
                                            //console.log(journal);
                                            //self.json(journal);
                                            cb(null, journal);
                                        }, function (err) {

                                            cb(err);
                                        });
                            }], function (err, journal) {
                            if (err)
                                return callback(err);

                            bill.journalId.push(journal._id);

                            bill.save(function (err, doc) {
                                if (err)
                                    return callback(err);
                                //console.log(doc);
                                callback(null);
                            });

                        });
                    });
        }, function (err) {
            if (err) {
                console.log(err);

                return self.json({
                    errorNotify: {
                        title: 'Erreur',
                        message: err.message || err
                    }
                });
            }

            return self.json({
                successNotify: {
                    title: "Success",
                    message: "Export compta enregistre"
                }
            });

        });
    },
    readDT: function () {
        var self = this;
        var BillModel = MODEL('bill').Schema;

        var query = JSON.parse(self.req.body.query);

        var Status;

        //console.log(self.query);

        var conditions = {
            //Status: {$ne: "PAID"},
            entity: self.query.entity
        };

        if (!query.search.value) {
            if (self.query.status_id) {
                if (self.query.status_id === 'VALIDATE' || self.query.status_id === 'NOT_PAID') {
                    Status = self.query.status_id;
                    conditions.Status = 'NOT_PAID';
                    if (Status === 'VALIDATE')
                        conditions.dater = {$gt: new Date()};
                    else
                        conditions.dater = {$lte: new Date()};
                } else
                    conditions.Status = self.query.status_id;
            }
        } else
            delete conditions.Status;


        if (!self.user.multiEntities)
            conditions.entity = self.user.entity;

        //console.log(self.query);
        if (self.query['client.id'])
            conditions['client.id'] = self.query['client.id'];

        var options = {
            conditions: conditions,
            select: "client.id dater journalId"
        };

        //console.log(options);

        async.parallel({
            status: function (cb) {
                Dict.dict({
                    dictName: "fk_bill_status",
                    object: true
                }, cb);
            },
            datatable: function (cb) {
                BillModel.dataTable(query, options, cb);
            }
        }, function (err, res) {
            if (err)
                return self.throw500(err);

            //console.log(res);

            for (var i = 0, len = res.datatable.data.length; i < len; i++) {
                var row = res.datatable.data[i];

                // Add checkbox
                res.datatable.data[i].bool = '<input type="checkbox" name="id[]" value="' + row._id + '"/>';
                // Add link company
                if (row.client && row.client.id)
                    res.datatable.data[i].client.name = '<a class="with-tooltip" href="#!/societe/' + row.client.id + '" data-tooltip-options=\'{"position":"top"}\' title="' + row.client.name + '"><span class="fa fa-institution"></span> ' + row.client.name + '</a>';
                else {
                    if (!row.client)
                        res.datatable.data[i].client = {};
                    res.datatable.data[i].client.name = '<span class="with-tooltip editable editable-empty" data-tooltip-options=\'{"position":"top"}\' title="Empty"><span class="fa fa-institution"></span> Empty</span>';
                }

                // Add id
                res.datatable.data[i].DT_RowId = row._id.toString();

                // Convert Status
                if (row.Status == 'NOT_PAID' && row.dater > new Date()) // Check if to late
                    row.Status = 'VALIDATE';

                res.datatable.data[i].Status = (res.status.values[row.Status] ? '<span class="label label-sm ' + res.status.values[row.Status].cssClass + '">' + i18n.t(res.status.lang + ":" + res.status.values[row.Status].label) + '</span>' : row.Status);

                if (res.datatable.data[i].journalId && res.datatable.data[i].journalId.length > 0)
                    // Add color line 
                    res.datatable.data[i].DT_RowClass = "bg-grey-silver";
                // Action
                res.datatable.data[i].action = '<a href="#!/bill/' + row._id + '" data-tooltip-options=\'{"position":"top"}\' title="' + row.ref + '" class="btn btn-xs default"><i class="fa fa-search"></i> View</a>';
                // Add url on name
                res.datatable.data[i].ref = '<a class="with-tooltip" href="#!/bill/' + row._id + '" data-tooltip-options=\'{"position":"top"}\' title="' + row.ref + '"><span class="fa fa-money"></span> ' + row.ref + '</a>';
                // Convert Date
                res.datatable.data[i].datec = (row.datec ? moment(row.datec).format(CONFIG('dateformatShort')) : '');
                res.datatable.data[i].dater = (row.dater ? moment(row.dater).format(CONFIG('dateformatShort')) : '');
                res.datatable.data[i].updatedAt = (row.updatedAt ? moment(row.updatedAt).format(CONFIG('dateformatShort')) : '');
                res.datatable.data[i].total_ttc = self.module('utils').round(res.datatable.data[i].total_ttc, 2);
            }

            //console.log(res.datatable);

            self.json(res.datatable);
        });
    },
    pdf: function (ref, self) {
        // Generation de la facture PDF et download

        if (!self)
            self = this;

        /*var discount = false;
         var cond_reglement_code = {};
         Dict.dict({dictName: "fk_payment_term", object: true}, function (err, docs) {
         cond_reglement_code = docs;
         });
         var mode_reglement_code = {};
         Dict.dict({dictName: "fk_paiement", object: true}, function (err, docs) {
         mode_reglement_code = docs;
         });*/

        Bill(ref, function (err, doc) {
            createBill(doc, true, function (err, tex) {
                if (err)
                    return console.log(err);

                self.res.setHeader('Content-type', 'application/pdf');
                Latex.Template(null, doc.entity)
                        .on('error', function (err) {
                            console.log(err);
                            self.throw500(err);
                        })
                        .compile("main", tex)
                        .pipe(self.res)
                        .on('close', function () {
                            //console.log('document written');
                        });
            });
        });
    },
    pdfAll: function () {
        var self = this;
        var id = [];

        if (typeof this.query.id != 'object')
            id.push(this.query.id);
        else
            id = this.query.id;

        var entity = this.query.entity;

        // Generation de la facture PDF et download
        var BillModel = MODEL('bill').Schema;

        var cond_reglement_code = {};
        Dict.dict({dictName: "fk_payment_term", object: true}, function (err, docs) {
            cond_reglement_code = docs;
        });
        var mode_reglement_code = {};
        Dict.dict({dictName: "fk_paiement", object: true}, function (err, docs) {
            mode_reglement_code = docs;
        });

        var tabTex = [];

        BillModel.find({Status: {$ne: "DRAFT"}, _id: {$in: id}}, function (err, bills) {
            if (err)
                return console.log(err);

            if (!bills.length)
                return self.json({error: "No bills"});

            async.each(bills, function (bill, cb) {

                createBill(bill, false, function (err, tex) {
                    if (err)
                        return cb(err);
                    //console.log(tex);

                    tabTex.push({id: bill.ref, tex: tex});
                    cb();
                });
            }, function (err) {
                if (err)
                    return console.log(err);

                var texOutput = "";

                function compare(x, y) {
                    var a = parseInt(x.id.substring(x.id.length - 6, x.id.length), 10);
                    var b = parseInt(y.id.substring(y.id.length - 6, y.id.length), 10);

                    if (a < b)
                        return -1;
                    if (a > b)
                        return 1;
                    return 0;
                }

                tabTex.sort(compare);

                for (var i = 0; i < tabTex.length; i++) {
                    if (i !== 0) {
                        texOutput += "\\newpage\n\n";
                        texOutput += "\\setcounter{page}{1}\n\n";
                    }

                    texOutput += tabTex[i].tex;
                }

                //console.log(texOutput);

                self.res.setHeader('Content-type', 'application/pdf');
                Latex.Template(null, entity)
                        .on('error', function (err) {
                            console.log(err);
                            self.throw500(err);
                        })
                        .compile("main", texOutput)
                        .pipe(self.res)
                        .on('close', function () {
                            console.log('document written');
                        });
            });
        });
    },
    releve_facture: function (id) {
        // Generation de la facture PDF et download
        var BillModel = MODEL('bill').Schema;
        var BankModel = MODEL('bank').Schema;
        var SocieteModel = MODEL('societe').Schema;
        var self = this;

        var cond_reglement_code = {};
        Dict.dict({dictName: "fk_payment_term", object: true}, function (err, docs) {
            cond_reglement_code = docs;
        });
        var mode_reglement_code = {};
        Dict.dict({dictName: "fk_paiement", object: true}, function (err, docs) {
            mode_reglement_code = docs;
        });

        BillModel.find({"client.id": id, entity: self.query.entity, Status: {$in: ["VALIDATE", "NOT_PAID", "STARTED"]}}, function (err, bills) {

            var doc = bills[0];
            //console.log(bills);
            //return;

            if (bills == null || bills.length == 0) {
                return self.json({error: "Il n'y aucune facture en attente de règlement"});
            }

            SocieteModel.findOne({_id: doc.client.id}, function (err, societe) {
                BankModel.findOne({ref: societe.bank_reglement}, function (err, bank) {
                    if (bank)
                        var iban = bank.name_bank + "\n RIB : " + bank.code_bank + " " + bank.code_counter + " " + bank.account_number + " " + bank.rib + "\n IBAN : " + bank.iban + "\n BIC : " + bank.bic;


                    var reglement = "";
                    switch (doc.mode_reglement_code) {
                        case "VIR" :
                            if (societe.bank_reglement) { // Bank specific for payment
                                reglement = "\n" + iban;
                            }
                            else // Default IBAN
                                reglement = "\n --IBAN--";
                            break;
                        case "CHQ" :
                            reglement = "A l'ordre de --ENTITY--";
                            break;
                    }

                    var tabLines = [];
                    tabLines.push({
                        keys: [
                            {key: "ref", type: "string"},
                            {key: "datec", "type": "date", "format": CONFIG('dateformatShort')},
                            {key: "ref_client", type: "string"},
                            {key: "dater", "type": "date", "format": CONFIG('dateformatShort')},
                            {key: "total_ht", type: "euro"},
                            {key: "total_ttc", type: "euro"}
                        ]
                    });

                    var total_toPay = 0;

                    for (var i = 0; i < bills.length; i++) {
                        tabLines.push({
                            ref: bills[i].ref,
                            datec: bills[i].datec,
                            ref_client: bills[i].ref_client,
                            dater: bills[i].dater,
                            total_ht: bills[i].total_ht,
                            total_ttc: bills[i].total_ttc
                        });
                        total_toPay += bills[i].total_ttc;
                    }



                    self.res.setHeader('Content-type', 'application/pdf');
                    Latex.Template("releve_facture.tex", self.query.entity)
                            .apply({
                                "DESTINATAIRE.NAME": {"type": "string", "value": doc.client.name},
                                "DESTINATAIRE.ADDRESS": {"type": "area", "value": doc.address},
                                "DESTINATAIRE.ZIP": {"type": "string", "value": doc.zip},
                                "DESTINATAIRE.TOWN": {"type": "string", "value": doc.town},
                                //"CODECLIENT": {"type": "string", "value": societe.code_client},
                                "DATEC": {
                                    "type": "date",
                                    "value": new Date(),
                                    "format": CONFIG('dateformatShort')
                                },
                                "REGLEMENT": {"type": "string", "value": cond_reglement_code.values[doc.cond_reglement_code].label},
                                "PAID": {"type": "string", "value": mode_reglement_code.values[doc.mode_reglement_code].label},
                                "BK": {"type": "area", "value": reglement},
                                "TABULAR": tabLines,
                                "APAYER": {
                                    "type": "euro",
                                    "value": total_toPay || 0
                                }
                            })
                            .on('error', function (err) {
                                console.log(err);
                                self.throw500(err);
                            })
                            .finalize(function (tex) {
                                //console.log('The document was converted.');
                            })
                            .compile()
                            .pipe(self.res)
                            .on('close', function () {
                                console.log('document written');
                            });

                    /*tex = tex.replace(/--APAYER--/g, latex.price(total_toPay));*/

                });
            });
        });
    },
    ca: function () {
        var BillModel = MODEL('bill').Schema;
        var self = this;

        var dateStart = moment(self.query.start).startOf('day').toDate();
        var dateEnd = moment(self.query.end).endOf('day').toDate();
        var ca = {};
        //console.log(self.query);

        var query = {
            Status: {'$ne': 'DRAFT'},
            datec: {'$gte': dateStart, '$lt': dateEnd}
        };

        if (self.query.entity)
            query.entity = self.query.entity;

        BillModel.aggregate([
            {$match: query},
            {$project: {_id: 0, total_ht: 1}},
            {$group: {_id: null, total_ht: {"$sum": "$total_ht"}}}
        ], function (err, doc) {
            if (err)
                return console.log(err);

            if (!doc.length)
                return self.json({total: 0});
            //console.log(doc);
            self.json({total: doc[0].total_ht});
        });
    },
    download: function (id) {
        var self = this;
        var BillModel = MODEL('bill').Schema;

        var object = new Object();

        BillModel.findOne({_id: id}, function (err, bill) {
            if (err)
                return self.throw500(err);

            if (!bill)
                return self.view404('Bill id not found');

            //var date = new Date();
            //order.updatedAt.setDate(order.updatedAt.getDate() + 15); // date + 15j, seulement telechargement pdt 15j

            //if (order.updatedAt < date)
            //    return self.view404('Order expired');

            object.pdf(id, self);

            bill.history.push({
                date: new Date(),
                mode: 'email',
                msg: 'email pdf telecharge',
                Status: 'notify'
            });

            bill.save();

        });
    }
};


function createBill(doc, cgv, callback) {
    var SocieteModel = MODEL('societe').Schema;
    var BankModel = MODEL('bank').Schema;
    // Generation de la facture PDF et download

    var discount = false;
    var cond_reglement_code = {};
    Dict.dict({dictName: "fk_payment_term", object: true}, function (err, docs) {
        cond_reglement_code = docs;
    });
    var mode_reglement_code = {};
    Dict.dict({dictName: "fk_paiement", object: true}, function (err, docs) {
        mode_reglement_code = docs;
    });


    var model = "facture.tex";
    // check if discount
    for (var i = 0; i < doc.lines.length; i++) {
        if (doc.lines[i].discount > 0) {
            model = "facture_discount.tex";
            discount = true;
            break;
        }
    }

    SocieteModel.findOne({_id: doc.client.id}, function (err, societe) {
        BankModel.findOne({ref: societe.bank_reglement}, function (err, bank) {
            if (bank)
                var iban = bank.name_bank + "\n RIB : " + bank.code_bank + " " + bank.code_counter + " " + bank.account_number + " " + bank.rib + "\n IBAN : " + bank.iban + "\n BIC : " + bank.bic;

            // Array of lines
            var tabLines = [];

            if (discount)
                tabLines.push({
                    keys: [
                        {key: "ref", type: "string"},
                        {key: "description", type: "area"},
                        {key: "tva_tx", type: "string"},
                        {key: "pu_ht", type: "number", precision: 3},
                        {key: "discount", type: "string"},
                        {key: "qty", type: "number", precision: 3},
                        {key: "total_ht", type: "euro"}
                    ]
                });
            else
                tabLines.push({
                    keys: [
                        {key: "ref", type: "string"},
                        {key: "description", type: "area"},
                        {key: "tva_tx", type: "string"},
                        {key: "pu_ht", type: "number", precision: 3},
                        {key: "qty", type: "number", precision: 3},
                        {key: "total_ht", type: "euro"}
                    ]
                });

            for (var i = 0; i < doc.lines.length; i++) {
                tabLines.push({
                    ref: (doc.lines[i].product.name != 'SUBTOTAL' ? doc.lines[i].product.name.substring(0, 12) : ""),
                    description: "\\textbf{" + doc.lines[i].product.label + "}\\\\" + doc.lines[i].description,
                    tva_tx: doc.lines[i].tva_tx,
                    pu_ht: doc.lines[i].pu_ht,
                    discount: (doc.lines[i].discount ? (doc.lines[i].discount + " %") : ""),
                    qty: doc.lines[i].qty,
                    total_ht: doc.lines[i].total_ht
                });

                if (doc.lines[i].product.name == 'SUBTOTAL') {
                    tabLines[tabLines.length - 1].italic = true;
                    tabLines.push({hline: 1});
                }
                //tab_latex += " & \\specialcell[t]{\\\\" + "\\\\} & " +   + " & " + " & " +  "\\tabularnewline\n";
            }

            // Array of totals
            var tabTotal = [{
                    keys: [
                        {key: "label", type: "string"},
                        {key: "total", type: "euro"}
                    ]
                }];

            // Frais de port 
            if (doc.shipping && doc.shipping.total_ht)
                tabTotal.push({
                    label: "Frais de port",
                    total: doc.shipping.total_ht
                });

            //Total HT
            tabTotal.push({
                label: "Total HT",
                total: doc.total_ht
            });

            for (var i = 0; i < doc.total_tva.length; i++) {
                tabTotal.push({
                    label: "Total TVA " + doc.total_tva[i].tva_tx + " %",
                    total: doc.total_tva[i].total
                });
            }

            //Total TTC
            tabTotal.push({
                label: "Total TTC",
                total: doc.total_ttc
            });

            var reglement = "";
            switch (doc.mode_reglement_code) {
                case "VIR" :
                    if (societe.bank_reglement) { // Bank specific for payment
                        reglement = "\n" + iban;
                    }
                    else // Default IBAN
                        reglement = "\n --IBAN--";
                    break;
                case "CHQ" :
                    reglement = "A l'ordre de --ENTITY--";
                    break;
            }

            /*tab_latex += "Total HT &" + latex.price(doc.total_ht) + "\\tabularnewline\n";
             for (var i = 0; i < doc.total_tva.length; i++) {
             tab_latex += "Total TVA " + doc.total_tva[i].tva_tx + "\\% &" + latex.price(doc.total_tva[i].total) + "\\tabularnewline\n";
             }
             tab_latex += "\\vhline\n";
             tab_latex += "Total TTC &" + latex.price(doc.total_ttc) + "\\tabularnewline\n";*/

            //Periode de facturation
            var period = "";
            if (doc.dateOf && doc.dateTo)
                period = "\\textit{P\\'eriode du " + moment(doc.dateOf).format(CONFIG('dateformatShort')) + " au " + moment(doc.dateTo).format(CONFIG('dateformatShort')) + "}\\\\";

            Latex.Template(model, doc.entity, {cgv: cgv})
                    .apply({
                        "NUM": {"type": "string", "value": doc.ref},
                        "DESTINATAIRE.NAME": {"type": "string", "value": doc.client.name},
                        "DESTINATAIRE.ADDRESS": {"type": "area", "value": doc.address},
                        "DESTINATAIRE.ZIP": {"type": "string", "value": doc.zip},
                        "DESTINATAIRE.TOWN": {"type": "string", "value": doc.town},
                        "DESTINATAIRE.TVA": {"type": "string", "value": societe.idprof6},
                        "CODECLIENT": {"type": "string", "value": societe.code_client},
                        //"TITLE": {"type": "string", "value": doc.title},
                        "REFCLIENT": {"type": "string", "value": doc.ref_client},
                        "PERIOD": {"type": "string", "value": period},
                        "DATEC": {
                            "type": "date",
                            "value": doc.datec,
                            "format": CONFIG('dateformatShort')
                        },
                        "DATEECH": {
                            "type": "date",
                            "value": doc.dater,
                            "format": CONFIG('dateformatShort')
                        },
                        "REGLEMENT": {"type": "string", "value": cond_reglement_code.values[doc.cond_reglement_code].label},
                        "PAID": {"type": "string", "value": mode_reglement_code.values[doc.mode_reglement_code].label},
                        "NOTES": {
                            "type": "string",
                            "value": (doc.notes.length ? doc.notes[0].note : "")
                        },
                        "BK": {"type": "area", "value": reglement},
                        "TABULAR": tabLines,
                        "TOTAL": tabTotal,
                        "APAYER": {
                            "type": "euro",
                            "value": doc.total_ttc || 0
                        }
                    })
                    .on('error', callback)
                    .finalize(function (tex) {
                        //console.log('The document was converted.');
                        callback(null, tex);
                    });
        });
    });
}
