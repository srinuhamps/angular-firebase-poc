// Phase 3: Firestore collection path — 'services/{id}'

/**
 * The list of service categories the admin can pick from. Hardcoded for now —
 * future work may move them to Firestore if the client wants to manage them
 * without a redeploy.
 *
 * The `value` is the slug persisted on each service document; the `label` is
 * what the customer / admin sees in dropdowns and filters.
 */
export const SERVICE_CATEGORIES = [
  { value: 'anas-hair-treatments',    label: "Ana's Hair Treatments"    },
  { value: 'box-braids',              label: 'Box Braids'               },
  { value: 'consultation',            label: 'Consultation'             },
  { value: 'corn-rows',               label: 'Corn Rows'                },
  { value: 'corn-rows-individuals',   label: 'Corn Rows + Individuals'  },
  { value: 'cornrow-ponytail',        label: 'Cornrow Ponytail'         },
  { value: 'crochet-braids',          label: 'Crochet Braids'           },
  { value: 'dread-faux-locs',         label: 'Dread/Faux Locs'          },
  { value: 'feed-in-stitch-braids',   label: 'Feed-in/Stich Braids'     },
  { value: 'head-spa',                label: 'Head Spa'                 },
  { value: 'kids-braids',             label: 'Kids Braids'              },
  { value: 'kids-microlocs',          label: 'Kids Microlocs'           },
  { value: 'knotless-braids',         label: 'Knotless Braids'          },
  { value: 'layers-tribal-braids',    label: 'Layers/ Tribals Braids'   },
  { value: 'lemonade-braids',         label: 'Lemonade Braids'          },
  { value: 'mens-braids',             label: "Men's Braids"             },
  { value: 'micro-hair',              label: 'Micro Hair'               },
  { value: 'microlocs',               label: 'MicroLocs'                },
  { value: 'microlocs-hair-extension',label: 'Microlocs Hair extension' },
  { value: 'microlocs-retie-maintenance', label: 'Microlocs Retie Maintenance' },
  { value: 'microlocs-specials',      label: 'Microlocs Specials'       },
  { value: 'mini-twist',              label: 'Mini Twist ( Faux Labellelocs )' },
  { value: 'sew-in',                  label: 'Sew In'                   },
  { value: 'shampoo',                 label: 'Shampoo Service'          },
  { value: 'starter-locs',            label: 'Starter Locs'             },
  { value: 'take-down',               label: 'Take Down'                },
  { value: 'touch-up',                label: 'Touch Up'                 },
  { value: 'tree-braid',              label: 'Tree Braid'               },
  { value: 'twist',                   label: 'Twist'                    },
] as const;


export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]['value'];

/** Human-readable label lookup for a category slug. Falls back to the slug. */
export function labelForCategory(value: string): string {
  return SERVICE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export interface HairService {
  id: string;
  name: string;
  category: ServiceCategory;
  shortDescription: string;
  description: string;
  price: number;
  duration: number;       // minutes
  imageUrl: string;
  /** Additional images shown in the details gallery / carousel. */
  mediaUrls?: string[];
  /** Optional video URL (YouTube embed, Vimeo, or Firebase Storage .mp4). */
  videoUrl?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  bookingEnabled: boolean;
  tags: string[];
  sortOrder: number;
  /**
   * IDs of ServiceAddons that specifically apply to this service — chosen by
   * the admin on the service form. Add-ons with `appliesToAll: true` are
   * always available and don't need to be listed here. Optional for
   * backward-compatibility with older documents that pre-date this field.
   */
  addonIds?: string[];
}
