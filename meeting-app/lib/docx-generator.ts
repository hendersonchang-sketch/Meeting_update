// Word 文件生成模組
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    TableRow,
    TableCell,
    Table,
    WidthType,
} from 'docx';
import { MeetingMinutes } from './types';
/**
 * 生成會議記錄 Word 文件
 */
export async function generateMeetingDocument(
    minutes: MeetingMinutes,
    customerType: string = 'nanshan'
): Promise<Buffer> {
    if (customerType === 'nanshan') {
        return generateNanshanDocument(minutes);
    }

    // 未來擴展其他客戶邏輯
    return generateNanshanDocument(minutes);
}

/**
 * [NSL 南山人壽] 專用生成邏輯
 */
async function generateNanshanDocument(minutes: MeetingMinutes): Promise<Buffer> {
    const sections: Paragraph[] = [];

    // 設定通用樣式屬性
    const defaultFont = 'Microsoft JhengHei';

    // 1. 公司名稱
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '南山人壽', size: 24, font: defaultFont })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
        })
    );

    // 2. 標題
    sections.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: minutes.info?.title || '114年度新機房基礎架構建置技術小組進度會議紀錄',
                    size: 28,
                    bold: true,
                    font: defaultFont,
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        })
    );

    // 3. 會議基本資訊 (時間、地點、記錄)
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: `時間：${minutes.info?.date || ''}`, font: defaultFont })],
            spacing: { after: 100 },
        })
    );

    sections.push(
        new Paragraph({
            children: [
                new TextRun({ text: `地點：${minutes.info?.location || ''}`, font: defaultFont }),
                new TextRun({ text: '\t\t', font: defaultFont }),
                new TextRun({ text: `記錄：${minutes.info?.recorder || ''}`, font: defaultFont }),
            ],
            spacing: { after: 200 },
        })
    );

    // 4. 出席人員
    if (minutes.attendees) {
        const attendeeRows = [
            { label: '出席：南山長官', data: minutes.attendees.companyLeaders },
            { label: '　　　技術小組代表', data: minutes.attendees.technicalTeam },
            { label: '　　　PM代表', data: minutes.attendees.pmTeam },
            { label: '　　　IBM代表', data: minutes.attendees.ibmTeam },
            { label: '　　　參與廠商', data: minutes.attendees.vendors },
        ];

        for (const row of attendeeRows) {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${row.label}：`, font: defaultFont }),
                        new TextRun({ text: (row.data && row.data.length > 0) ? row.data.join('、') : '無', font: defaultFont }),
                    ],
                    spacing: { after: 100 },
                })
            );
        }
    }

    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '討論紀錄與重點紀錄：', font: defaultFont })],
            spacing: { before: 200, after: 200 },
        })
    );

    // 一、重點紀錄
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '一 重點紀錄', size: 24, bold: true, font: defaultFont })],
            spacing: { before: 200, after: 100 },
        })
    );

    if (minutes.keyPoints && minutes.keyPoints.length > 0) {
        for (const point of minutes.keyPoints) {
            // 小標題 (例如 1.機房搬遷：)
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: `${point.category}：`, font: defaultFont })],
                    spacing: { before: 100, after: 100 },
                })
            );

            if (point.content && point.content.length > 0) {
                for (const content of point.content) {
                    if (content !== '無') {
                        sections.push(
                            new Paragraph({
                                children: [new TextRun({ text: content, font: defaultFont })],
                                bullet: { level: 0 },
                                spacing: { after: 60 },
                                indent: { left: 360, hanging: 180 },
                            })
                        );
                    }
                }
            }
        }
    }

    // 二、待辦事項
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '二 待辦事項：', size: 24, bold: true, font: defaultFont })],
            spacing: { before: 400, after: 100 },
        })
    );

    if (minutes.actionItems && minutes.actionItems.length > 0) {
        for (const item of minutes.actionItems) {
            if (item.description !== '無') {
                sections.push(
                    new Paragraph({
                        children: [new TextRun({ text: item.description, font: defaultFont })],
                        bullet: { level: 0 },
                        spacing: { after: 60 },
                        indent: { left: 360, hanging: 180 },
                    })
                );
            }
        }
    } else {
        sections.push(new Paragraph({ children: [new TextRun({ text: '無', font: defaultFont })] }));
    }

    // 三、風險管理事項
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '三 風險管理事項：', size: 24, bold: true, font: defaultFont })],
            spacing: { before: 400, after: 100 },
        })
    );

    sections.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: '＊必要時風險評估需依循南山內部程序進行（如風管、法遵、資安等）',
                    font: defaultFont,
                    size: 20,
                }),
            ],
            spacing: { after: 100 },
        })
    );

    if (minutes.riskItems && minutes.riskItems.length > 0) {
        for (const item of minutes.riskItems) {
            if (item.description !== '無') {
                sections.push(
                    new Paragraph({
                        children: [new TextRun({ text: item.description, font: defaultFont })],
                        bullet: { level: 0 },
                        spacing: { after: 60 },
                        indent: { left: 360, hanging: 180 },
                    })
                );
            }
        }
    } else {
        sections.push(new Paragraph({ children: [new TextRun({ text: '無', font: defaultFont })] }));
    }

    // 四、其他事項紀錄
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: '四 其他事項紀錄', size: 24, bold: true, font: defaultFont })],
            spacing: { before: 400, after: 100 },
        })
    );

    if (minutes.otherNotes && minutes.otherNotes.length > 0) {
        for (const note of minutes.otherNotes) {
            if (note !== '無') {
                sections.push(
                    new Paragraph({
                        children: [new TextRun({ text: note, font: defaultFont })],
                        bullet: { level: 0 },
                        spacing: { after: 60 },
                        indent: { left: 360, hanging: 180 },
                    })
                );
            }
        }
    } else {
        sections.push(new Paragraph({ children: [new TextRun({ text: '無', font: defaultFont })] }));
    }

    // 5. 散會
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: `散會：${minutes.endTime || ''}`, font: defaultFont })],
            spacing: { before: 400 },
        })
    );

    // 建立文件
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: defaultFont,
                    },
                },
            },
        },
        sections: [
            {
                properties: {},
                children: sections,
            },
        ],
    });

    // 轉換為 Buffer
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}
