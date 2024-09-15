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

            onSearch: async function () {
                const view = this.getView();
                const model = view.getModel();
                view.setModel(new JSONModel([]), 'ucManualModel');
                const masterOrder = (view.byId('cb_master_order')?.mProperties?.value?.trim() ?? '');
                if (masterOrder === '') {
                    MessageToast.show('Informe a ordem mestre!');
                    return;
                }

                await model.read('/ZGKPP_DD_CONTAINER_CALC', {
                    urlParameters: {
                        $filter: `MasterProductionOrder eq '${masterOrder.trim()}'`,
                        $expand: 'to_Boxes',
                        $select: 'MasterProductionOrder,GenericMaterial,to_Boxes/ProductionOrder,to_Boxes/Material,to_Boxes/MaterialSize,to_Boxes/SizeOrder,to_Boxes/Box,to_Boxes/BoxDescription,to_Boxes/Quantity'
                    },

                    success: function (data) {
                        if (data.results.length === 0) {
                            MessageToast.show('Ordem mestre não encontrada.');
                            return;
                        }

                        view.setModel(new JSONModel({
                            MasterProductionOrder: data.results[0]?.MasterProductionOrder,
                            Material: data.results[0]?.GenericMaterial,
                            Boxes: data.results[0]?.to_Boxes?.results?.map(box => { return {
                                ProductionOrder: box.ProductionOrder,
                                Material: box.Material,
                                MaterialSize: box.MaterialSize,
                                SizeOrder: box.SizeOrder,
                                Box: box.Box,
                                BoxDescription: box.BoxDescription,
                                Quantity: box.Quantity
                            }})
                        }), 'masterOrderData');

                        this._buildBoxCapacityTableDynamically();
                        this._fillBoxCapacityTableDynamically();
                        this._buildManualUcGenerationTableDynamically();
                        this._fillManualUcGenerationTableDynamically();
                        this._buildQuantityCheckTableDynamically();
                        this._fillQuantityCheckTableDynamically();
                    }.bind(this)
                });
            },

            _buildBoxCapacityTableDynamically: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();
                const table = view.byId('box_capacity_table');
                const sizes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                if (!sizes || sizes.length === 0) {
                    MessageToast.show('Não foram encontradas caixas para a ordem mestre informada.');
                    return;
                }

                table.getColumns().forEach((column) => {
                    if (!column.getId().includes('_size_')) return;
                    column.destroy();
                });

                sizes.forEach((size) => {
                    table.addColumn(new sap.m.Column({
                        id: `box_capacity_table_column_size_${size}`,
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
            },

            _fillBoxCapacityTableDynamically: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();

                const boxes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map(it => it.Box) ?? [])];
                const rows = [...boxes.map(box => {
                    const row = { Caixa: data.Boxes?.find(it => it.Box === box)?.BoxDescription?.trim() ?? '' };
                    (data.Boxes?.filter(it => it.Box === box) ?? []).forEach(it => {
                        row[`cadCaixasModelSize_${it.MaterialSize}`] = it.Quantity;
                    });
                    return row;
                })];
                view.setModel(new JSONModel(rows), 'cadCaixasModel');
            },

            _buildManualUcGenerationTableDynamically: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();
                const table = view.byId('manual_uc_generation_table');
                const sizes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                if (!sizes || sizes.length === 0) {
                    MessageToast.show('Não foram encontradas caixas para a ordem mestre informada.');
                    return;
                }

                table.getColumns().forEach((column) => {
                    if (!column.getId().includes('_size_')) return;
                    column.destroy();
                });

                sizes.forEach((size) => {
                    table.addColumn(new sap.m.Column({
                        id: `manual_uc_column_size_${size}`,
                        header: new sap.m.Text({ text: size.trim() }),
                        width: 'auto',
                        hAlign: 'Center'
                    }));
                });

                const comboBoxItems = [
                    ...new Set(data.Boxes?.map((box) => box.Box) ?? [])
                ].map((box) => ({ key: box, text: (data.Boxes?.find((it) => it.Box === box)?.BoxDescription?.trim() ?? '') }));
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
                                width: 'auto',
                                editable: '{ucManualModel>RowIsNew}'
                            }),
                            new sap.m.ComboBox({
                                items: {
                                    path: 'comboBoxItems>/items',
                                    template: new sap.ui.core.Item({ key: '{comboBoxItems>key}', text: '{comboBoxItems>text}' }),
                                    templateShareable: false
                                },
                                selectedKey: '{ucManualModel>Box}',
                                enabled: '{ucManualModel>RowIsNew}'
                            }),
                            ...sizes.map((size) => new sap.m.Input({
                                value: `{ucManualModel>UcManualGenerationSize_${size}}`,
                                type: 'Number',
                                width: 'auto',
                                editable: '{ucManualModel>RowIsNew}'
                            }))
                        ]
                    })
                });
            },

            _fillManualUcGenerationTableDynamically: function () {
                const view = this.getView();
                const model = view.getModel('getHandlingUnitsService');
                const masterOrderData = view.getModel('masterOrderData')?.getData();

                view.setModel(new JSONModel([]), 'ucManualModel');
                model.read('/HandlingUnit', {
                    urlParameters: {
                        $filter: `ZZ1_OrdemMestre_HUH eq '${masterOrderData.MasterProductionOrder.trim()}'`,
                        $expand: 'to_HandlingUnitItem',
                        $select: 'HandlingUnitExternalID,PackagingMaterial,to_HandlingUnitItem/Material,to_HandlingUnitItem/HandlingUnitQuantity',
                        $orderby: 'HandlingUnitExternalID asc'
                    },

                    success: function (data) {
                        if (data.results.length === 0) return;
                        const masterOrderData = view.getModel('masterOrderData').getData();

                        const boxes = [...new Set(data.results.map(it => it.PackagingMaterial))];
                        const rows = boxes.map((box) => {
                            const row = {
                                UnitsPerBox: data.results.find(it => it.PackagingMaterial === box).to_HandlingUnitItem.results[0].HandlingUnitQuantity,
                                RecordSelected: false,
                                RowIsNew: false,
                                Box: box,
                                HandlingUnitExternalIDs: data.results.filter(it => it.PackagingMaterial === box)?.map(it => it.HandlingUnitExternalID)
                            };
                            
                            const sizes = [...new Set(masterOrderData.Boxes.filter(it => it.Box === box).map(it => it.MaterialSize))];
                            sizes.forEach((size) => {
                                const material = masterOrderData.Boxes.find(it => it.Box === box && it.MaterialSize === size)?.Material;
                                row[`UcManualGenerationSize_${size}`] = data.results.filter(it => it.PackagingMaterial === box && it.to_HandlingUnitItem.results[0].Material === material).length
                            });

                            return row;
                        });

                        view.setModel(new JSONModel(rows), 'ucManualModel');
                    }
                });
            },

            _addRowToManualUcGenerator: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();
                const sizes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                if (!sizes || sizes.length === 0) {
                    MessageToast.show('Não foram encontradas caixas para a ordem mestre informada.');
                    return;
                }

                const newRow = { UnitsPerBox: 0, RecordSelected: false, RowIsNew: true };
                sizes.forEach(it => {
                    newRow[`UcManualGenerationSize_${it}`] = '0'
                });

                const ucManualModel = view.getModel('ucManualModel').getData();
                view.setModel(new JSONModel(Array.isArray(ucManualModel) ? [...ucManualModel, newRow] : [newRow]), 'ucManualModel');
            },

            _removeRowsFromManualUcGenerator: async function () {
                const view = this.getView();
                const rows = view.getModel('ucManualModel')?.getData();
                if (!rows || !Array.isArray(rows)) return;
                
                rows.filter(row => row.RecordSelected && !row.RowIsNew && row.HandlingUnitExternalIDs).forEach(async (row) => {
                    row.HandlingUnitExternalIDs.forEach(async (it) => {
                        try {
                            await fetch('/sap/opu/odata/sap/ZAPI_HU_MAINTAIN_SRV/HandlingUnitSet', {
                                method: 'POST',
                                body: JSON.stringify({
                                    HandlingUnitExternalID: it.trim(),
                                    HandlingUnitDelete: 'X',
                                    Return_Messages: []
                                }),
                                headers: {
                                    'Content-Type': 'application/json; charset=UTF-8',
                                    'Accept': 'application/json',
                                    'X-REQUESTED-WITH': 'XMLHttpRequest'
                                }
                            }).then(response => response.json()).then(data => {
                                if (data.d.Return_Messages.results.length > 0) {
                                    throw data.d.Return_Messages.results.map(it => it.Message.trim()).join('\n');
                                }
                            });
                        } catch {}
                    });
                });

                MessageToast.show('Registros excluídos com sucesso!');
                this._fillManualUcGenerationTableDynamically();
            },

            _buildQuantityCheckTableDynamically: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();
                const table = view.byId('quantity_check_table');
                const sizes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                if (!sizes || sizes.length === 0) {
                    MessageToast.show('Não foram encontradas caixas para a ordem mestre informada.');
                    return;
                }

                table.getColumns().forEach((column) => {
                    if (!column.getId().includes('size')) return;
                    column.destroy();
                });

                sizes.forEach((size) => {
                    table.addColumn(new sap.m.Column({
                        id: `quantity_check_table_column_size_${size}`,
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
            },

            _fillQuantityCheckTableDynamically: function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData').getData();

                const sizes = [...new Set(data.Boxes?.sort((a, b) => Number(a.SizeOrder) - Number(b.SizeOrder))?.map((box) => box.MaterialSize))];
                const rows = [{ Item: "Quantidade da ordem" }, { Item: "Quantidade gerada" }, { Item: "Saldo" }];
                rows.forEach((row) => {
                    sizes.forEach((size) => {
                        row[`quantityCheckSize_${size}`] = '0';
                    });
                });
                view.setModel(new JSONModel(rows), 'quantityCheckModel');
            },

            _runManualUcGeneration: async function () {
                const view = this.getView();
                const data = view.getModel('masterOrderData')?.getData();
                const rows = view.getModel('ucManualModel')?.getData();
                if (!data || !rows || rows.length === 0) return;

                rows.filter(row => row.RowIsNew).forEach(row => {
                    Object.getOwnPropertyNames(row).filter(it => it.includes('UcManualGenerationSize_')).forEach(it => {
                        if (row[it] === '0') return;

                        const size = it.replace('UcManualGenerationSize_', '').trim();
                        const payload = ({
                            HandlingUnitExternalID: '$1', // Fixed
                            PackagingMaterial: data.Boxes.find((box) => box.Box === row.Box && box.MaterialSize === size)?.Box.trim(),
                            ZZ1_OrdemMestre_HUH: data.MasterProductionOrder.trim(),
                            ZZ1_OrdemdeProduo_HUH: data.Boxes.find((box) => box.Box === row.Box && box.MaterialSize === size)?.ProductionOrder?.trim(),
                            HuHeader_Response: [], // Fixed
                            HuItem_Response: [], // Fixed
                            Return_Messages: [], // Fixed
                            HandlingUnitItems: [{
                                HandlingUnitExternalID: '$1', // Fixed
                                Material: data.Boxes.find((box) => box.Box === row.Box && box.MaterialSize === size)?.Material.trim(),
                                Plant: '1000', // Fixed
                                HandlingUnitQuantity: row.UnitsPerBox
                            }]
                        });

                        Array.from({ length: row[it] }, (_, i) => i + 1).forEach(async () => {
                            try {
                                await fetch('/sap/opu/odata/sap/ZAPI_HU_MAINTAIN_SRV/HandlingUnitSet', {
                                    method: 'POST',
                                    body: JSON.stringify(payload),
                                    headers: {
                                        'Content-Type': 'application/json; charset=UTF-8',
                                        'Accept': 'application/json',
                                        'X-REQUESTED-WITH': 'XMLHttpRequest'
                                    }
                                }).then(response => response.json()).then(data => {
                                    if (data.d.Return_Messages.results.length > 0) {
                                        throw data.d.Return_Messages.results.map(it => it.Message.trim()).join('\n');
                                    }
                                });
                            } catch (error) { MessageToast.show(`Erro ao criar registros: ${error}`); }
                        });
                    });
                });

                this._fillManualUcGenerationTableDynamically();
                MessageToast.show('Registros criados com sucesso!');
            }
        });
    });