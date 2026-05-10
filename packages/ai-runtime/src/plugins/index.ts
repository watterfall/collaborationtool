// Public API for the plugin system (Phase 2 W1 skeleton per ADR-0010).
//
// Consumers (agent-runner, mcp-client, apps/web admin install route)
// only import from here, never reach into individual modules.

export {
  loadPlugin,
  loadAgentPlugin,
  MANIFEST_FILENAME,
  PluginLoadError,
} from './loader';
export { parseManifest, PluginManifestError } from './manifest';
export {
  loadPluginRegistry,
  findAgentByKind,
  resolvePluginAbsolutePath,
  _resetPluginRegistryCache,
  type RegisteredPlugin,
} from './registry';
export type {
  AgentManifest,
  AgentPluginInput,
  AgentPluginModule,
  BasePluginManifest,
  BilingualString,
  LoadedAgentPlugin,
  LoadedPlugin,
  McpServerManifest,
  PluginKind,
  PluginManifest,
  SkillManifest,
  UiPanelManifest,
} from './types';

// Phase 4 W1 ADR-0012 install backend: capability prompt model +
// sandbox descriptor builder + install row payload helper.
export {
  buildCapabilityPrompt,
  buildSandboxDescriptor,
  buildLinuxBwrapArgs,
  buildInstallRowPayload,
  InstallRejectedError,
  type BuildInstallRowInput,
  type BuildSandboxDescriptorInput,
  type CapabilityPromptRow,
  type LinuxBwrapDescriptor,
  type MacOsSandboxExecDescriptor,
  type PluginInstallOrigin,
  type PluginInstallRowPayload,
  type PluginInstallStatus,
  type SandboxDescriptor,
  type SandboxPlatform,
  type WindowsAppContainerDescriptor,
} from './install';
