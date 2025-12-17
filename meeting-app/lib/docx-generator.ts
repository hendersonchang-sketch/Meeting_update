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

// 生成會議紀錄 Word 文件
export async function generateMeetingDocument(minutes: MeetingMinutes): Promise<Buffer> {
    const sections: Paragraph[] = [];

    // 公司名稱
    sections.push(
        new Paragraph({
            text: '南山人壽',
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
        })
    );

    // 標題
    sections.push(
        new Paragraph({
            text: minutes.info?.title || '會議紀錄',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        })
    );

    // 會議資訊：時間
    if (minutes.info?.date) {
        sections.push(
            new Paragraph({
                text: `時間：${minutes.info.date}`,
                spacing: { after: 100 },
            })
        );
    }

    // 會議資訊：地點、記錄人
    if (minutes.info?.location || minutes.info?.recorder) {
        const infoTexts: TextRun[] = [];
        if (minutes.info?.location) {
            infoTexts.push(new TextRun({ text: `地點：${minutes.info.location}` }));
        }
        if (minutes.info?.recorder) {
            if (infoTexts.length > 0) {
                infoTexts.push(new TextRun({ text: '        ' }));
            }
            infoTexts.push(new TextRun({ text: `記錄：${minutes.info.recorder}` }));
        }
        sections.push(
            new Paragraph({
                children: infoTexts,
                spacing: { after: 200 },
            })
        );
    }

    // 出席人員
    if (minutes.attendees) {
        sections.push(
            new Paragraph({
                text: '出席人員',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
            })
        );

        const attendeeGroups = [
            { label: '南山長官', data: minutes.attendees.companyLeaders },
            { label: '技術小組', data: minutes.attendees.technicalTeam },
            { label: 'PM代表', data: minutes.attendees.pmTeam },
            { label: 'IBM代表', data: minutes.attendees.ibmTeam },
            { label: '參與廠商', data: minutes.attendees.vendors },
        ];

        for (const group of attendeeGroups) {
            if (group.data && group.data.length > 0) {
                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${group.label}：`, bold: true }),
                            new TextRun({ text: group.data.join('、') }),
                        ],
                        spacing: { after: 100 },
                    })
                );
            }
        }
    }

    // 一、重點紀錄
    if (minutes.keyPoints && minutes.keyPoints.length > 0) {
        sections.push(
            new Paragraph({
                text: '一、重點紀錄',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
            })
        );

        for (const point of minutes.keyPoints) {
            // 類別標題格式：「類別：」（無編號，無括號）
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${point.category}：`, bold: true }),
                    ],
                    spacing: { before: 200, after: 100 },
                })
            );

            if (point.content && point.content.length > 0) {
                for (const content of point.content) {
                    sections.push(
                        new Paragraph({
                            text: `• ${content}`,
                            spacing: { after: 80 },
                            indent: { left: 360 },
                        })
                    );
                }
            }
        }
    }

    // 二、待辦事項
    sections.push(
        new Paragraph({
            text: '二、待辦事項',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
        })
    );

    if (minutes.actionItems && minutes.actionItems.length > 0) {
        for (let i = 0; i < minutes.actionItems.length; i++) {
            const item = minutes.actionItems[i];
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${i + 1}. ${item.description}`, bold: true }),
                    ],
                    spacing: { before: 100, after: 50 },
                })
            );

            if (item.assignee) {
                sections.push(
                    new Paragraph({
                        text: `   負責人：${item.assignee}`,
                        spacing: { after: 50 },
                        indent: { left: 360 },
                    })
                );
            }

            if (item.deadline) {
                sections.push(
                    new Paragraph({
                        text: `   截止日期：${item.deadline}`,
                        spacing: { after: 50 },
                        indent: { left: 360 },
                    })
                );
            }
        }
    } else {
        sections.push(
            new Paragraph({
                text: '無',
                spacing: { after: 200 },
            })
        );
    }

    // 三、風險管理事項
    sections.push(
        new Paragraph({
            text: '三、風險管理事項',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
        })
    );

    sections.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: '＊必要時風險評估需依循南山內部程序進行（如風管、法遵、資安等）',
                    italics: true,
                    color: '666666',
                }),
            ],
            spacing: { after: 200 },
        })
    );

    if (minutes.riskItems && minutes.riskItems.length > 0) {
        for (let i = 0; i < minutes.riskItems.length; i++) {
            const item = minutes.riskItems[i];
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${i + 1}. ${item.description}`, bold: true }),
                    ],
                    spacing: { before: 100, after: 50 },
                })
            );

            if (item.mitigation) {
                sections.push(
                    new Paragraph({
                        text: `   緩解措施：${item.mitigation}`,
                        spacing: { after: 50 },
                        indent: { left: 360 },
                    })
                );
            }
        }
    } else {
        sections.push(
            new Paragraph({
                text: '無',
                spacing: { after: 200 },
            })
        );
    }

    // 四、其他事項紀錄
    sections.push(
        new Paragraph({
            text: '四、其他事項紀錄',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
        })
    );

    if (minutes.otherNotes && minutes.otherNotes.length > 0) {
        for (let i = 0; i < minutes.otherNotes.length; i++) {
            sections.push(
                new Paragraph({
                    text: `${i + 1}. ${minutes.otherNotes[i]}`,
                    spacing: { after: 80 },
                })
            );
        }
    } else {
        sections.push(
            new Paragraph({
                text: '無',
                spacing: { after: 200 },
            })
        );
    }

    // 散會時間
    if (minutes.endTime) {
        sections.push(
            new Paragraph({
                text: `散會：${minutes.endTime}`,
                spacing: { before: 400, after: 200 },
            })
        );
    }

    // 建立文件
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Microsoft JhengHei',
                    },
                },
                heading1: {
                    run: {
                        font: 'Microsoft JhengHei',
                        size: 32,
                        bold: true,
                    },
                    paragraph: {
                        spacing: { after: 240 },
                    },
                },
                heading2: {
                    run: {
                        font: 'Microsoft JhengHei',
                        size: 28,
                        bold: true,
                    },
                    paragraph: {
                        spacing: { before: 240, after: 120 },
                    },
                },
            },
        },
        sections: [
            {
                children: sections,
            },
        ],
    });

    // 轉換為 Buffer
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}
