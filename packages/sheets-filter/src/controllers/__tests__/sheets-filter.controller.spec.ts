/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { IWorkbookData, Workbook } from '@univerjs/core';
import { ICommandService, Inject, Injector, IUniverInstanceService, LocaleType, Plugin, RANGE_TYPE, UndoCommand, Univer, UniverInstanceType } from '@univerjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ISetRangeValuesMutationParams } from '@univerjs/sheets';
import { MoveColsCommand, MoveColsMutation, MoveRowsCommand, MoveRowsMutation, RefRangeService, SetRangeValuesMutation, SetSelectionsOperation, SheetInterceptorService, SheetsSelectionsService } from '@univerjs/sheets';
import { SHEET_FILTER_SNAPSHOT_ID, SheetsFilterService } from '../../services/sheet-filter.service';
import { SheetsFilterController } from '../sheets-filter.controller';

function testWorkbookDataWithFilterFactory(): IWorkbookData {
    return {
        id: 'test',
        appVersion: '3.0.0-alpha',
        sheets: {
            sheet1: {
                id: 'sheet1',
                cellData: {
                    0: {
                        0: {
                            v: 'A1',
                        },
                        1: {
                            v: 'B1',
                        },
                        2: {
                            v: 'C1',
                        },
                        3: {
                            v: 'D1',
                        },
                    },
                    1: {
                        0: {
                            v: 'A2',
                        },
                        1: {
                            v: 'B2',
                        },
                        2: {
                            v: 'C2',
                        },
                        3: {
                            v: 'D2',
                        },
                    },
                    2: {
                        0: {
                            v: 'A3',
                        },
                        1: {
                            v: 'B3',
                        },
                        2: {
                            v: 'C3',
                        },
                        3: {
                            v: 'D3',
                        },
                    },
                    3: {
                        0: {
                            v: 'A',
                        },
                        1: {
                            v: 'B',
                        },
                        2: {
                            v: 'C',
                        },
                        3: {
                            v: 'D',
                        },
                    },
                },
                name: 'Sheet-001',
            },
        },
        resources: [
            {
                name: SHEET_FILTER_SNAPSHOT_ID,
                data: JSON.stringify({
                    sheet1: {
                        ref: { startRow: 3, startColumn: 0, endRow: 5, endColumn: 5 },
                    },
                }),
            },
        ],
        locale: LocaleType.ZH_CN,
        name: '',
        sheetOrder: [],
        styles: {},
    };
}

function createFilterControllerTestBed(workbookData?: IWorkbookData) {
    const univer = new Univer();
    const injector = univer.__getInjector();
    const get = injector.get.bind(injector);

    class SheetsFilterTestPlugin extends Plugin {
        static override type = UniverInstanceType.UNIVER_SHEET;
        static override pluginName = 'SheetsFilterTestPlugin';

        constructor(_config: unknown, @Inject(Injector) protected readonly _injector: Injector) {
            super();
        }

        override onStarting(): void {
            this._injector.add([RefRangeService]);
            this._injector.add([SheetsFilterService]);
            this._injector.add([SheetsFilterController]);
            this._injector.add([SheetsSelectionsService]);
            this._injector.add([SheetInterceptorService]);
        }

        override onReady(): void {
            this._injector.get(SheetsFilterController);
        }
    }

    univer.registerPlugin(SheetsFilterTestPlugin);

    const sheet = univer.createUniverSheet(workbookData || testWorkbookDataWithFilterFactory());

    const sheetsFilterService = get(SheetsFilterService);
    const commandService = get(ICommandService);

    ([
        MoveRowsCommand,
        MoveRowsMutation,
        MoveColsCommand,
        MoveColsMutation,
        SetSelectionsOperation,
        SetRangeValuesMutation,
    ]
    ).forEach((command) => commandService.registerCommand(command));

    return {
        univer,
        get,
        sheet,
        sheetsFilterService,
        commandService,
    };
}

describe('test controller of sheets filter', () => {
    let univer: Univer;
    let get: Injector['get'];
    let commandService: ICommandService;
    let sheetsFilterService: SheetsFilterService;
    let instanceService: IUniverInstanceService;

    beforeEach(() => {
        const testBed = createFilterControllerTestBed();
        univer = testBed.univer;
        get = testBed.get;

        commandService = get(ICommandService);
        sheetsFilterService = get(SheetsFilterService);
        instanceService = get(IUniverInstanceService);
        instanceService.setCurrentUnitForType('test');
        instanceService.focusUnit('test');
    });

    afterEach(() => {
        univer.dispose();
    });

    describe('test interceptor of move-rows-command', () => {
        it('should be success when move row before filter header', async () => {
            await commandService.executeCommand(SetSelectionsOperation.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                selections: [
                    {
                        range: {
                            rangeType: RANGE_TYPE.ROW,
                            startRow: 0,
                            endRow: 0,
                        },
                    },
                ],
            });
            const result = await commandService.executeCommand(MoveRowsCommand.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                fromRange: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 5 },
                toRange: { startRow: 2, startColumn: 0, endRow: 2, endColumn: 5 },
            });
            expect(result).toBeTruthy();
            expect((sheetsFilterService as SheetsFilterService).getFilterModel('test', 'sheet1')!.getRange())
                .toEqual({ startRow: 3, startColumn: 0, endRow: 5, endColumn: 5 });
            const workbook = instanceService.getCurrentUnitForType<Workbook>(UniverInstanceType.UNIVER_SHEET)!;
            expect(workbook.getSheetBySheetId('sheet1')?.getCell(0, 0)?.v).toBe('A2');
            expect(workbook.getSheetBySheetId('sheet1')?.getCell(1, 0)?.v).toBe('A1');
        });
    });

    describe('test interceptor of move-cols-command', () => {
        it('should be restored when undo move cols command', async () => {
            await commandService.executeCommand(SetSelectionsOperation.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                selections: [
                    {
                        range: {
                            rangeType: RANGE_TYPE.COLUMN,
                            startRow: 0,
                            endRow: 10,
                            startColumn: 0,
                            endColumn: 5,
                        },
                    },
                ],
            });
            const result = await commandService.executeCommand(MoveColsCommand.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                fromRange: { startRow: 0, startColumn: 0, endRow: 10, endColumn: 5 },
                toRange: { startRow: 0, startColumn: 10, endRow: 10, endColumn: 15 },
            });
            expect(result).toBeTruthy();
            expect((sheetsFilterService as SheetsFilterService).getFilterModel('test', 'sheet1')!.getRange())
                .toEqual({ startRow: 3, startColumn: 4, endRow: 5, endColumn: 9 });

            expect(await commandService.executeCommand(UndoCommand.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
            })).toBeTruthy();
            expect((sheetsFilterService as SheetsFilterService).getFilterModel('test', 'sheet1')!.getRange())
                .toEqual({ startRow: 3, startColumn: 0, endRow: 5, endColumn: 5 });
        });
    });

    describe('test extend range of filter', () => {
        it('should not be extended when edit null', async () => {
            expect(await commandService.executeCommand(SetRangeValuesMutation.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                cellValue: {
                    6: {
                        0: {
                            f: null,
                        },
                    },
                },
            } as ISetRangeValuesMutationParams)).toBeTruthy();
            expect((sheetsFilterService as SheetsFilterService).getFilterModel('test', 'sheet1')!.getRange())
                .toEqual({ startRow: 3, startColumn: 0, endRow: 5, endColumn: 5 });
        });
        it('should be extended when edit not null', async () => {
            expect(await commandService.executeCommand(SetRangeValuesMutation.id, {
                unitId: 'test',
                subUnitId: 'sheet1',
                cellValue: {
                    6: {
                        0: {
                            v: 'test',
                        },
                    },
                },
            } as ISetRangeValuesMutationParams)).toBeTruthy();
            expect((sheetsFilterService as SheetsFilterService).getFilterModel('test', 'sheet1')!.getRange())
                .toEqual({ startRow: 3, startColumn: 0, endRow: 6, endColumn: 5 });
        });
    });
});
