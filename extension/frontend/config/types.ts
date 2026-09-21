import {ButtonType} from '../api/types';

export type TextSource = {mode: 'field'; fieldId: string | null} | {mode: 'template'; template: string};

export interface ButtonConfig {
    type: ButtonType;
    text: string;
    value: TextSource | null;
}

export type MessageConfig =
    | {type: 'text'; text: TextSource}
    | {type: 'file'; file: TextSource; caption: TextSource | null}
    | {type: 'location'; latitude: TextSource; longitude: TextSource; name: TextSource | null; address: TextSource | null}
    | {type: 'contact'; phone: TextSource; firstName: TextSource | null; lastName: TextSource | null; company: TextSource | null}
    | {type: 'poll'; question: TextSource; options: string[]; multipleAnswers: boolean}
    | {type: 'buttons'; header: TextSource | null; body: TextSource; footer: TextSource | null; buttons: ButtonConfig[]};

export type MessageType = MessageConfig['type'];

export interface WriteBackConfig {
    statusFieldId: string | null;
    idMessageFieldId: string | null;
    sentAtFieldId: string | null;
    checkFieldId: string | null;
    chatIdFieldId: string | null;
}

export interface MappingConfig {
    tableId: string | null;
    viewId: string | null;
    phoneFieldId: string | null;
    message: MessageConfig;
    writeBack: WriteBackConfig;
}

export interface ServerConfig {
    url: string;
}

export interface GlobalConfigV1 {
    v: 1;
    server: ServerConfig;
    mapping: MappingConfig;
}
