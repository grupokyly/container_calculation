/*global QUnit*/

sap.ui.define([
	"container_calculation/controller/ContainerCalculationView.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ContainerCalculationView Controller");

	QUnit.test("I should test the ContainerCalculationView controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
