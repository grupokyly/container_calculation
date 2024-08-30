sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (
        JSONModel,
        Controller,
        MessageToast
    ) {
        "use strict";

        return Controller.extend("containercalculation.controller.ContainerCalculationView", {
            onInit: function () {
                const view = this.getView();
                view.addStyleClass('blueBoldLabel');
            },

            onSearch: function () {
                const view = this.getView();
                const masterOrder = (view.byId('cb_master_order')?.mProperties?.value ?? '');
                if (masterOrder === '') {
                    MessageToast.show('Informe a ordem mestre!');
                    return;
                }

                view.setModel(new JSONModel(), 'cadCaixasModel');
                view.setModel(new JSONModel(), 'ucManualModel');

                this._fillDataOverviewSection(masterOrder);
                this._buildBoxCapacityTableDynamically(masterOrder);
                this._fillBoxCapacityTableDynamically(masterOrder);
                this._buildManualUcGenerationTableDynamically(masterOrder);
                this._buildQuantityCheckTableDynamically(masterOrder);
                this._fillQuantityCheckTableDynamically(masterOrder);
            },

            _fillDataOverviewSection: function(masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $select: 'MasterProductionOrder,Material'
                    },

                    success: function(data) {
                        if (data.results.length === 0) {
                            MessageToast.show('Ordem mestre não encontrada.');
                            return;
                        }
                        
                        view.setModel(new JSONModel({ 
                            MasterProductionOrder: data.results[0]?.MasterProductionOrder,
                            Material: data.results[0]?.Material
                        }), 'masterOrderData');
                    }
                });
            },

            _buildBoxCapacityTableDynamically: function (masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();
                const table = view.byId('box_capacity_table');
                
                table.getColumns().forEach((column) => {
                    if (column.getId().includes('column_caixa')) return;
                    column.destroy();
                });

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/Box'
                    },

                    success: function (data) {
                        const sizes = data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize);
                        if (!sizes || sizes.length === 0) {
                            MessageToast.show('Não foram encontradas caixas para a ordem mestre informada.');
                            return;
                        }

                        sizes.forEach((size) => {
                            table.addColumn(new sap.m.Column({
                                header: new sap.m.Text({ text: size.trim() }),
                                width: 'auto',
                                hAlign: 'Center'
                            }));
                        });

                        table.bindItems({
                            path: 'cadCaixasModel>/',
                            template: new sap.m.ColumnListItem({
                                cells: [
                                    new sap.m.FormattedText({ htmlText: '{cadCaixasModel>Caixa}' }),
                                    ...sizes.map((size) => new sap.m.Text({ text: `{cadCaixasModel>cadCaixasModelSize_${size}}` }))
                                ]
                            })
                        });
                    }
                });
            },

            _fillBoxCapacityTableDynamically: function (masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/Box,to_Boxes/BoxDescription,to_Boxes/Quantity'
                    },

                    success: function (data) {
                        const boxes = [...new Set(data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map(it => it.Box) ?? [])];
                        const rows = [...boxes.map(box => {
                            const row = { Caixa: data.results[0]?.to_Boxes?.results?.find(it => it.Box === box)?.BoxDescription?.trim() ?? '' };
                            (data.results[0]?.to_Boxes?.results?.filter(it => it.Box === box) ?? []).forEach(it => {
                                row[`cadCaixasModelSize_${it.MaterialSize}`] = it.Quantity;
                            });
                            return row;
                        })];
                        view.setModel(new JSONModel(rows), 'cadCaixasModel');
                    }
                });
            },

            _buildManualUcGenerationTableDynamically: function (masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();
                const table = view.byId('manual_uc_generation_table');

                table.getColumns().forEach((column) => {
                    if (column.getId().includes('manual_uc_column_pecas_caixa') || column.getId().includes('manual_uc_column_uc_manual_caixa') || column.getId().includes('manual_uc_column_record_selected')) return;
                    column.destroy();
                });

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/Box,to_Boxes/BoxDescription'
                    },

                    success: function (data) {
                        const sizes = data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize);
                        if (!sizes || sizes.length === 0) return;

                        sizes.forEach((size) => {
                            table.addColumn(new sap.m.Column({
                                header: new sap.m.Text({ text: size.trim() }),
                                width: 'auto',
                                hAlign: 'Center'
                            }));
                        });

                        const comboBoxItems = [
                            ...new Set(data.results[0]?.to_Boxes?.results?.map((box) => box.Box) ?? [])
                        ].map((box) => ({ key: box, text: (data.results[0]?.to_Boxes?.results?.find((it) => it.Box === box)?.BoxDescription?.trim() ?? '') }));
                        view.setModel(new JSONModel({ items: comboBoxItems }), 'comboBoxItems');

                        table.bindItems({
                            path: 'ucManualModel>/',
                            template: new sap.m.ColumnListItem({
                                cells: [
                                    new sap.m.CheckBox({
                                        selected: '{ucManualModel>RecordSelected}',
                                        useEntireWidth: false
                                    }),
                                    new sap.m.Input({
                                        value: '{ucManualModel>UnitsPerBox}',
                                        type: 'Number',
                                        width: 'auto'
                                    }),
                                    new sap.m.ComboBox({
                                        items: {
                                            path: 'comboBoxItems>/items',
                                            template: new sap.ui.core.Item({ key: '{comboBoxItems>key}', text: '{comboBoxItems>text}' }),
                                            templateShareable: false
                                        },
                                        selectedKey: '{ucManualModel>Box}'
                                    }),
                                    ...sizes.map((size) => new sap.m.Input({
                                        value: `{ucManualModel>UcManualGenerationSize_${size}}`,
                                        type: 'Number',
                                        width: 'auto'
                                    }))
                                ]
                            })
                        });
                    }
                });
            },

            _addRowToManualUcGenerator: function () {
                const view = this.getView();
                const model = this.getView().getModel();
                const masterOrder = (view.byId('cb_master_order')?.mProperties?.value ?? '');
                if (masterOrder === '') return;

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/SizeOrder,to_Boxes/Box'
                    },

                    success: function (data) {
                        const sizes = [...new Set(data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                        if (!sizes || sizes.length === 0) return;
                        
                        const newRow = { UnitsPerBox: 0, RecordSelected: false };
                        sizes.forEach(it => {
                            newRow[`UcManualGenerationSize_${it}`] = '0'
                            newRow[`UcManualGenerationSizeOrder_${it}`] = data.results[0]?.to_Boxes?.results?.find((box) => box.MaterialSize === it)?.SizeOrder;
                        });
                        
                        const ucManualModel = view.getModel('ucManualModel').getData();
                        view.setModel(new JSONModel(Array.isArray(ucManualModel) ? [...ucManualModel, newRow] : [newRow]), 'ucManualModel');
                    }
                });
            },

            _removeRowsFromManualUcGenerator: function () {
                const view = this.getView();
                const ucManualModel = view.getModel('ucManualModel')?.getData();
                if (!ucManualModel || !Array.isArray(ucManualModel)) return;
                view.setModel(new JSONModel(ucManualModel.filter(it => !it.RecordSelected)), 'ucManualModel');
            },

            _buildQuantityCheckTableDynamically: function (masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();
                const table = view.byId('quantity_check_table');

                table.getColumns().forEach((column) => {
                    if (column.getId().includes('column_quantity_check_item')) return;
                    column.destroy();
                });

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/Box,to_Boxes/BoxDescription,to_Boxes/Quantity'
                    },

                    success: function (data) {
                        const sizes = [...new Set(data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                        if (!sizes || sizes.length === 0) return;

                        sizes.forEach((size) => {
                            table.addColumn(new sap.m.Column({
                                header: new sap.m.Text({ text: size.trim() }),
                                width: 'auto',
                                hAlign: 'Center'
                            }));
                        });

                        table.bindItems({
                            path: 'quantityCheckModel>/',
                            template: new sap.m.ColumnListItem({
                                cells: [
                                    new sap.m.FormattedText({ htmlText: '{quantityCheckModel>Item}' }),
                                    ...sizes.map((size) => new sap.m.Text({ text: `{quantityCheckModel>quantityCheckSize_${size}}` }))
                                ]
                            })
                        });
                    }
                });
            },

            _fillQuantityCheckTableDynamically: function (masterOrder) {
                const view = this.getView();
                const model = this.getView().getModel();

                model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'to_Boxes/MaterialSize,to_Boxes/SizeOrder'
                    },

                    success: function (data) {
                        const sizes = [...new Set(data.results[0]?.to_Boxes?.results?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                        const rows = [{ Item: "Quantidade da ordem" }, { Item: "Quantidade gerada" }, { Item: "Saldo" }];
                        rows.forEach((row) => {
                            sizes.forEach((size) => {
                                row[`quantityCheckSize_${size}`] = '0';
                            });
                        });
                        view.setModel(new JSONModel(rows), 'quantityCheckModel');
                    }
                });
            },

            _runManualUcGeneration: function() {
                const view = this.getView();
                const model = this.getView().getModel();
                const data = view.getModel('masterOrderData')?.getData();
                const items = (view.getModel('ucManualModel')?.getData() ?? []);
                if (!data || items.length == 0) return;

                // const v4model = new sap.ui.model.odata.v4.ODataModel({
                //     serviceUrl: 'https://s4dev2.grupokyly.com/sap/opu/odata4/sap/ZGKPP_DD_CONTAINER_CALC_SRV/srvd_a2x/sap/ZGKPP_DD_CONTAINER_CALC_SRV/0001/',
                //     synchronizationMode: 'None',
               
                // });
// teste
                const v4model = this.getView().getModel('handlingUnits');
                console.log(v4model);

                model.read('/HandlingUnit', {
                    // urlParameters: {},

                    success: function(data) {
                        console.log(data);
                    },
                    error: function(data) {
                        console.log(data);
                    }
                });

                // const payload = ({
                //     PackagingMaterial: data.Material.trim(),
                //     Plant: '1000', // Fixed
                //     _HandlingUnitItem: []
                // });

                // items.forEach(item => {
                //     for (var prop in item) {
                //         if (prop.startsWith('UcManualGenerationSize_')) {
                //             payload._HandlingUnitItem.push({
                //                 Material: item.Box?.trim(),
                //                 HandlingUnitQuantity: Number(item[prop]),
                //                 HandlingUnitQuantityUnit: 'KG', // Fixed
                //                 _sequence: item[`UcManualGenerationSizeOrder_${prop.replace('UcManualGenerationSize_', '').trim()}`],
                //             });
                //         }
                //     }
                // });

                // payload._HandlingUnitItem = payload._HandlingUnitItem.sort((a, b) => Number(a.sequence) - Number(b.sequence)).map(it => { delete it._sequence; return it; });
                // if (payload._HandlingUnitItem.length === 0) {
                //     MessageToast.show('Nenhuma quantidade informada.');
                //     return;
                // }

                // const listBinding = v4model.bindList('/HandlingUnit');
                // listBinding.requestContexts().then(function (aContexts) {
                //     console.log(aContexts);
                //     aContexts.forEach(function (oContext) {
                //         console.log(oContext);
                //     });
                // });

                // model.create('https://s4dev2.grupokyly.com:443/sap/opu/odata4/sap/API_HANDLINGUNIT/srvd_a2x/sap/API_HANDLINGUNIT/0001/HandlingUnit', payload, {
                //     success: function (data) {
                //         MessageToast.show('Ordens de manuseio criadas com sucesso.');
                //     },
                //     error: function (data) {
                //         MessageToast.show('Erro ao criar ordens de manuseio.');
                //     }
                // });
            },
        });
    });