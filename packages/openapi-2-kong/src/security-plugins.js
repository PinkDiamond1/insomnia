// @flow

import { getSecurity } from './common';

export function generateSecurityPlugins(op: OA3Operation, api: OpenApi3Spec): Array<DCPlugin> {
  const plugins = [];
  const components = api.components || {};
  const securitySchemes = components.securitySchemes || {};

  const security = getSecurity(op) || getSecurity(api) || [];
  for (const securityItem of security) {
    for (const name of Object.keys(securityItem)) {
      const scheme: OA3SecurityScheme = securitySchemes[name] || {};
      const args = securityItem[name];

      const p = generateSecurityPlugin(scheme, args);

      if (p) {
        plugins.push(p);
      }
    }
  }

  return plugins;
}

export function generateApiKeySecurityPlugin(scheme: OA3SecuritySchemeApiKey): DCPlugin {
  if (!['query', 'header', 'cookie'].includes(scheme.in)) {
    throw new Error(`a ${scheme.type} object expects valid "in" property. Got ${scheme.in}`);
  }
  if (!scheme.name) {
    throw new Error(`a ${scheme.type} object expects valid "name" property. Got ${scheme.name}`);
  }

  return {
    name: 'key-auth',
    config: { key_names: [scheme.name] },
  };
}

export function generateHttpSecurityPlugin(scheme: OA3SecuritySchemeHttp): DCPlugin {
  if (scheme.scheme !== 'basic') {
    throw new Error(`Only "basic" http scheme supported. got ${scheme.scheme}`);
  }

  return {
    name: 'basic-auth',
    config: {},
  };
}

export function generateOpenIdConnectSecurityPlugin(
  scheme: OA3SecuritySchemeOpenIdConnect,
  args: Array<any>,
): DCPlugin {
  if (!scheme.openIdConnectUrl) {
    throw new Error(`invalid "openIdConnectUrl" property. Got ${scheme.openIdConnectUrl}`);
  }

  return {
    name: 'openid-connect',
    config: {
      issuer: scheme.openIdConnectUrl,
      scopes_required: args || [],
    },
  };
}

export function generateOAuth2SecurityPlugin(
  scheme: OA3SecuritySchemeOAuth2,
  args: ?Array<any>,
): DCPlugin {
  return {
    config: {
      auth_methods: ['client_credentials'],
    },
    name: 'openid-connect',
  };
}

export function generateSecurityPlugin(
  scheme: OA3SecurityScheme,
  args: Array<any>,
): DCPlugin | null {
  let plugin: DCPlugin | null = null;

  // Generate base plugin
  if (scheme.type === 'apiKey') {
    plugin = generateApiKeySecurityPlugin(scheme);
  } else if (scheme.type === 'http') {
    plugin = generateHttpSecurityPlugin(scheme);
  } else if (scheme.type === 'openIdConnect') {
    plugin = generateOpenIdConnectSecurityPlugin(scheme, args);
  } else if (scheme.type === 'oauth2') {
    plugin = generateOAuth2SecurityPlugin(scheme);
  } else {
    return null;
  }

  // Add additional plugin configuration from x-kong-* properties
  for (const key of Object.keys((scheme: Object))) {
    if (key.indexOf('x-kong-security-') !== 0) {
      continue;
    }

    const kongSecurity = scheme[key];

    if (kongSecurity.config) {
      plugin.config = kongSecurity.config;
    }
  }

  return plugin;
}