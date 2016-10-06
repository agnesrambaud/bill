"use strict";
/* global angular: true */

//Bills resource used for REST endpoint
MetronicApp.factory("Bills", ['$resource', function ($resource) {
        return $resource('/erp/api/bill/:Id', {
            Id: '@_id'
        }, {
            update: {
                method: 'PUT'
            },
            clone: {
                method: 'POST',
                params: {
                    clone: 1
                }
            }
        });
    }]);