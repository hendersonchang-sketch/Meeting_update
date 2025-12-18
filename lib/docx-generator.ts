import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Packer,
    TabStopType,
    TabStopPosition,
    LevelFormat,
    convertInchesToTwip,
} from 'docx';
import * as fs from 'fs';
import { MeetingMinutes } from './types';

/**
 * 根據會議記錄資料生成 Word 文件
 * 格式完全遵循南山人壽技術小組會議記錄範本
 */
export async function generateMeetingDocument(
    minutes: MeetingMinutes
): Promise<Buffer> {
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(1),
                            bottom: convertInchesToTwip(1),
                            left: convertInchesToTwip(1.25),
                            right: convertInchesToTwip(1.25),
                        },
                    },
                },
                children: [
                    // 公司名稱
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '南山人壽',
                                size: 36, // 18pt
                                font: '標楷體',
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                    }),

                    // 會議標題
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '114年度新機房基礎架構建置技術小組進度會議紀錄',
                                size: 28, // 14pt
                                font: '標楷體',
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                    }),

                    // 時間
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `時間：${minutes.info.date}（${getDayOfWeek(minutes.info.date)}）${minutes.info.time}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 地點與記錄
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `地點：${minutes.info.location || '民權東路二段144號7樓會議室'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                            new TextRun({
                                text: `        記錄：${minutes.info.recorder || '待確認'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 出席 - 南山長官
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `出席：南山長官：${minutes.attendees.companyLeaders.join(', ') || '待確認'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 出席 - 技術小組代表
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `\t技術小組代表：${minutes.attendees.technicalTeam.join(', ') || '待確認'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 出席 - PM代表
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `\tPM代表：${minutes.attendees.pmTeam.join(', ') || '待確認'}`,
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 出席 - IBM代表
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `\tIBM代表：${minutes.attendees.ibmTeam.join(', ') || '待確認'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 出席 - 參與廠商
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `\t  參與廠商：${minutes.attendees.vendors.join('、') || '待確認'}`,
                                size: 28,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 200 },
                    }),

                    // 討論紀錄與重點紀錄標題
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '討論紀錄與重點紀錄：',
                                size: 28,
                                font: '標楷體',
                                bold: true,
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    // 一、重點紀錄
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '一 重點紀錄',
                                size: 24, // 12pt
                                font: '標楷體',
                            }),
                        ],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 100 },
                    }),

                    // 各項重點紀錄
                    ...generateKeyPointsParagraphs(minutes.keyPoints),

                    // 二、待辦事項
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '二 待辦事項：',
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 100 },
                    }),

                    ...generateActionItemsParagraphs(minutes.actionItems),

                    // 三、風險管理事項
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '三 風險管理事項：',
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '＊必要時風險評估需依循南山內部程序進行（如風管、法遵、資安等）',
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { after: 100 },
                    }),

                    ...generateRiskItemsParagraphs(minutes.riskItems),

                    // 四、其他事項紀錄
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '四 其他事項紀錄',
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 100 },
                    }),

                    ...generateOtherNotesParagraphs(minutes.otherNotes),

                    // 散會時間
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `散會：${minutes.endTime || '待確認'}`,
                                size: 24,
                                font: '標楷體',
                            }),
                        ],
                        spacing: { before: 200 },
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
}

/**
 * 生成重點紀錄段落（嚴格遵循固定 7 個分類）
 */
function generateKeyPointsParagraphs(keyPoints: MeetingMinutes['keyPoints']): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // 固定的 7 個分類標題（順序不可變動）
    const fixedCategories = [
        '機房搬遷',
        '機房服務',
        '網路、資安',
        '儲存',
        'SAP（HW）',
        '文心機房搬遷',
        '現代化顧問服務',
    ];

    // 建立分類對應表
    const categoryMap = new Map<string, string[]>();
    for (const point of keyPoints) {
        categoryMap.set(point.category, point.content);
    }

    // 依照固定順序輸出
    fixedCategories.forEach((category, index) => {
        // 分類標題（數字編號 1. 2. ...）
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${index + 1}. ${category}：`,
                        size: 24,
                        font: '標楷體',
                        bold: true,
                    }),
                ],
                spacing: { before: 200, after: 100 },
            })
        );

        // 取得該分類的內容，若無則顯示「無」
        let contents = categoryMap.get(category) || ['無'];

        for (const content of contents) {
            // 更強大的清理邏輯：偵測並移除「1. 分類名稱：」等前綴
            const categoryEscaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cleanRegex = new RegExp(`^(\\d+[\\.、\\s]*)?(${categoryEscaped})?[：:\\s]*`, '');
            const cleanContent = content.replace(cleanRegex, '').trim();

            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: cleanContent,
                            size: 24,
                            font: '標楷體',
                        }),
                    ],
                    bullet: { level: 1 }, // 保持 level 1 (通常是圓圈)
                    spacing: { after: 50 },
                })
            );
        }
    });

    return paragraphs;
}

/**
 * 生成待辦事項段落
 */
function generateActionItemsParagraphs(actionItems: MeetingMinutes['actionItems']): Paragraph[] {
    if (!actionItems || actionItems.length === 0) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '無',
                        size: 24,
                        font: '標楷體',
                    }),
                ],
            }),
        ];
    }

    return actionItems.map(
        (item) =>
            new Paragraph({
                children: [
                    new TextRun({
                        text: item.description,
                        size: 24,
                        font: '標楷體',
                    }),
                    item.assignee
                        ? new TextRun({
                            text: `（${item.assignee}）`,
                            size: 24,
                            font: '標楷體',
                        })
                        : new TextRun({ text: '' }),
                ],
                bullet: { level: 0 },
                spacing: { after: 50 },
            })
    );
}

/**
 * 生成風險管理事項段落
 */
function generateRiskItemsParagraphs(riskItems: MeetingMinutes['riskItems']): Paragraph[] {
    if (!riskItems || riskItems.length === 0) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '無',
                        size: 24,
                        font: '標楷體',
                    }),
                ],
            }),
        ];
    }

    return riskItems.map(
        (item) =>
            new Paragraph({
                children: [
                    new TextRun({
                        text: item.description,
                        size: 24,
                        font: '標楷體',
                    }),
                ],
                bullet: { level: 0 },
                spacing: { after: 50 },
            })
    );
}

/**
 * 生成其他事項段落
 */
function generateOtherNotesParagraphs(notes: string[]): Paragraph[] {
    if (!notes || notes.length === 0) {
        return [
            new Paragraph({
                children: [
                    new TextRun({
                        text: '無',
                        size: 24,
                        font: '標楷體',
                    }),
                ],
            }),
        ];
    }

    return notes.map(
        (note) =>
            new Paragraph({
                children: [
                    new TextRun({
                        text: note,
                        size: 24,
                        font: '標楷體',
                    }),
                ],
                bullet: { level: 0 },
                spacing: { after: 50 },
            })
    );
}

/**
 * 根據日期取得星期幾
 */
function getDayOfWeek(dateStr: string): string {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    // 嘗試解析不同格式的日期
    let date: Date;

    // 嘗試 "民國XXX年X月X日" 格式
    const rocMatch = dateStr.match(/民國(\d+)年(\d+)月(\d+)日/);
    if (rocMatch) {
        const year = parseInt(rocMatch[1]) + 1911;
        const month = parseInt(rocMatch[2]) - 1;
        const day = parseInt(rocMatch[3]);
        date = new Date(year, month, day);
    } else {
        // 嘗試其他格式
        date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
        return '星期X';
    }

    return days[date.getDay()];
}

/**
 * 儲存 Word 文件到指定路徑
 */
export async function saveMeetingDocument(
    minutes: MeetingMinutes,
    outputPath: string
): Promise<string> {
    const buffer = await generateMeetingDocument(minutes);
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
}

/**
 * 從現有 Word 文件讀取內容（用於解析上傳的參考文件）
 */
export function extractTextFromDocx(filePath: string): Promise<string> {
    // 這裡需要使用其他套件來讀取 docx 內容
    // 暫時返回佔位符
    return Promise.resolve('');
}
