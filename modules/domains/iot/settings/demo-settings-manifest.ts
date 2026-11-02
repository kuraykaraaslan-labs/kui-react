import type { DeviceSettingsSchema } from '../types/settings';

/**
 * The demo's settings manifest: next-boilerplate's `roltek-420` fixture (firewall, firewall rules, Wi-Fi, LTE) with a `firewall_redirects`
 * section added, so the port forwards and their internet warning can be tried here. A router's real manifest comes from its firmware build.
 */
export const DEMO_SETTINGS_MANIFEST: DeviceSettingsSchema = {
  hash: 'demo-6ae095f5d4c04630b6ff87d77c6774724956940127479af8ad6cc4a1c7cef18d',
  model: 'roltek-420',
  fw: '1.4.2',
  released: '2026-10-01',
  verified: true,
  sections: {
  "firewall": {
    "title": {
      "en": "Firewall",
      "tr": "Güvenlik duvarı"
    },
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "zones"
      ],
      "x-roltek": {
        "class": "admin",
        "connectivity": true,
        "restarts": "service:firewall",
        "path": "Device.Firewall."
      },
      "properties": {
        "zones": {
          "type": "array",
          "maxItems": 16,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "input",
              "forward"
            ],
            "properties": {
              "name": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "networks": {
                "type": "array",
                "maxItems": 8,
                "items": {
                  "type": "string",
                  "maxLength": 32,
                  "pattern": "^[a-z][a-z0-9_]{0,31}$"
                }
              },
              "input": {
                "type": "string",
                "enum": [
                  "ACCEPT",
                  "REJECT",
                  "DROP"
                ]
              },
              "output": {
                "type": "string",
                "enum": [
                  "ACCEPT",
                  "REJECT",
                  "DROP"
                ]
              },
              "forward": {
                "type": "string",
                "enum": [
                  "ACCEPT",
                  "REJECT",
                  "DROP"
                ]
              },
              "masquerade": {
                "type": "boolean",
                "default": false
              }
            }
          }
        },
        "forwardings": {
          "type": "array",
          "maxItems": 32,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "src",
              "dest"
            ],
            "properties": {
              "src": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "dest": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              }
            }
          }
        }
      }
    }
  },
  "firewall_rules": {
    "title": {
      "en": "Firewall rules",
      "tr": "Güvenlik duvarı kuralları"
    },
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "rules"
      ],
      "x-roltek": {
        "class": "admin",
        "connectivity": true,
        "restarts": "service:firewall",
        "path": "Device.Firewall.Chain.{i}.Rule."
      },
      "properties": {
        "rules": {
          "type": "array",
          "maxItems": 160,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "src",
              "target"
            ],
            "properties": {
              "name": {
                "type": "string",
                "maxLength": 64
              },
              "enabled": {
                "type": "boolean",
                "default": true
              },
              "src": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "dest": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "proto": {
                "type": "string",
                "enum": [
                  "tcp",
                  "udp",
                  "tcpudp",
                  "icmp",
                  "any"
                ]
              },
              "destPort": {
                "type": "integer",
                "minimum": 1,
                "maximum": 65535,
                "format": "port"
              },
              "srcIp": {
                "type": "string",
                "maxLength": 43,
                "format": "cidr"
              },
              "target": {
                "type": "string",
                "enum": [
                  "ACCEPT",
                  "REJECT",
                  "DROP"
                ]
              },
              "exposesWan": {
                "type": "boolean",
                "default": false,
                "x-roltek": {
                  "class": "dangerous"
                }
              }
            }
          }
        }
      }
    }
  },
  "wifi": {
    "title": {
      "en": "Wi-Fi",
      "tr": "Wi-Fi"
    },
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "radios",
        "ssids"
      ],
      "x-roltek": {
        "class": "admin",
        "restarts": "network",
        "path": "Device.WiFi."
      },
      "properties": {
        "country": {
          "type": "string",
          "maxLength": 2,
          "pattern": "^[A-Z]{2}$",
          "x-roltek": {
            "remote": false,
            "path": "Device.WiFi.Radio.{i}.RegulatoryDomain"
          }
        },
        "radios": {
          "type": "array",
          "maxItems": 3,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "band",
              "channel"
            ],
            "properties": {
              "band": {
                "type": "string",
                "enum": [
                  "2g",
                  "5g",
                  "6g"
                ]
              },
              "channel": {
                "oneOf": [
                  {
                    "const": "auto"
                  },
                  {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 233
                  }
                ]
              },
              "width": {
                "type": "string",
                "enum": [
                  "HT20",
                  "HT40",
                  "VHT80",
                  "HE80"
                ]
              }
            }
          }
        },
        "ssids": {
          "type": "array",
          "maxItems": 8,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "ssid",
              "band",
              "security"
            ],
            "properties": {
              "ssid": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32,
                "x-roltek": {
                  "path": "Device.WiFi.SSID.{i}.SSID"
                }
              },
              "band": {
                "type": "string",
                "enum": [
                  "2g",
                  "5g",
                  "6g"
                ]
              },
              "security": {
                "type": "string",
                "enum": [
                  "open",
                  "wpa2-psk",
                  "wpa3-sae",
                  "wpa2-wpa3"
                ]
              },
              "key": {
                "type": "string",
                "minLength": 8,
                "maxLength": 63,
                "x-roltek": {
                  "sensitive": true,
                  "path": "Device.WiFi.AccessPoint.{i}.Security.KeyPassphrase"
                }
              },
              "hidden": {
                "type": "boolean",
                "default": false
              },
              "isolate": {
                "type": "boolean",
                "default": false
              }
            }
          }
        }
      }
    }
  },
  "lte": {
    "title": {
      "en": "LTE",
      "tr": "LTE"
    },
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "apns",
        "activeApn"
      ],
      "x-roltek": {
        "class": "admin",
        "connectivity": true,
        "confirmS": 300,
        "restarts": "network",
        "path": "Device.Cellular."
      },
      "properties": {
        "apns": {
          "type": "array",
          "maxItems": 8,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "apn"
            ],
            "properties": {
              "name": {
                "type": "string",
                "maxLength": 32
              },
              "apn": {
                "type": "string",
                "maxLength": 64,
                "pattern": "^[A-Za-z0-9.-]{1,64}$",
                "x-roltek": {
                  "path": "Device.Cellular.AccessPoint.{i}.APN"
                }
              },
              "auth": {
                "type": "string",
                "enum": [
                  "none",
                  "pap",
                  "chap"
                ]
              },
              "username": {
                "type": "string",
                "maxLength": 64
              },
              "password": {
                "type": "string",
                "maxLength": 64,
                "x-roltek": {
                  "sensitive": true
                }
              },
              "ipType": {
                "type": "string",
                "enum": [
                  "ipv4",
                  "ipv6",
                  "ipv4v6"
                ]
              }
            }
          }
        },
        "activeApn": {
          "type": "string",
          "maxLength": 32
        },
        "bands": {
          "type": "array",
          "maxItems": 32,
          "items": {
            "type": "integer",
            "minimum": 1,
            "maximum": 255
          },
          "x-roltek": {
            "class": "dangerous"
          }
        },
        "mode": {
          "type": "string",
          "enum": [
            "auto",
            "4g",
            "5g"
          ],
          "x-roltek": {
            "class": "dangerous"
          }
        },
        "roamingGuard": {
          "type": "boolean",
          "default": true
        }
      }
    }
  },
  "firewall_redirects": {
    "title": {
      "en": "Port forwards",
      "tr": "Port yönlendirmeleri"
    },
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "redirects"
      ],
      "x-roltek": {
        "class": "admin",
        "connectivity": true,
        "restarts": "service:firewall",
        "path": "Device.NAT.PortMapping."
      },
      "properties": {
        "redirects": {
          "type": "array",
          "maxItems": 64,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "proto",
              "srcDport",
              "destIp",
              "destPort"
            ],
            "properties": {
              "name": {
                "type": "string",
                "maxLength": 64
              },
              "enabled": {
                "type": "boolean",
                "default": true
              },
              "src": {
                "type": "string",
                "maxLength": 32,
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "proto": {
                "type": "string",
                "enum": [
                  "tcp",
                  "udp",
                  "tcpudp"
                ]
              },
              "srcDport": {
                "type": "integer",
                "minimum": 1,
                "maximum": 65535,
                "format": "port"
              },
              "destIp": {
                "type": "string",
                "maxLength": 15,
                "format": "ipv4"
              },
              "destPort": {
                "type": "integer",
                "minimum": 1,
                "maximum": 65535,
                "format": "port"
              },
              "exposesWan": {
                "type": "boolean",
                "default": false,
                "x-roltek": {
                  "class": "dangerous"
                }
              }
            }
          }
        }
      }
    }
  }
},
};
