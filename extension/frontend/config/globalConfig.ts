import {useGlobalConfig} from '@airtable/blocks/ui';
import {CONFIG_ROOT_KEY, CONFIG_VERSION} from '../defaults';
import {migrateConfig, stripNulls} from './parse';
import {GlobalConfigV1, MessageConfig, ServerConfig} from './types';

export type GlobalConfig = ReturnType<typeof useGlobalConfig>;

export const configPath = (...segments: string[]): string[] => [CONFIG_ROOT_KEY, ...segments];

export function useConfig(): {config: GlobalConfigV1; globalConfig: GlobalConfig; canEdit: boolean; reason: string} {
    const globalConfig = useGlobalConfig();
    const config = migrateConfig(globalConfig.get(CONFIG_ROOT_KEY));
    const permission = globalConfig.checkPermissionsForSet(CONFIG_ROOT_KEY);
    return {
        config,
        globalConfig,
        canEdit: permission.hasPermission,
        reason: permission.hasPermission ? '' : permission.reasonDisplayString,
    };
}

async function write(globalConfig: GlobalConfig, path: string[], value: unknown): Promise<void> {
    await globalConfig.setPathsAsync([
        {path: configPath('v'), value: CONFIG_VERSION},
        {path: configPath(...path), value: stripNulls(value)},
    ]);
}

export function writeServer(globalConfig: GlobalConfig, server: ServerConfig): Promise<void> {
    return write(globalConfig, ['server'], server);
}

export function writeMessage(globalConfig: GlobalConfig, message: MessageConfig): Promise<void> {
    return write(globalConfig, ['mapping', 'message'], message);
}

