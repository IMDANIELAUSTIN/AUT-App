export type TaxLocationCode =
  | "MANUAL"
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "DC" | "FL"
  | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME"
  | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH"
  | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI"
  | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI"
  | "WY" | "AS" | "GU" | "MP" | "PR" | "VI";

export type TaxLocation = {
  code: TaxLocationCode;
  label: string;
  rate: number;
  note?: string;
};

// Flat estimates for the app's existing tax model. These are not full bracket calculations.
export const TAX_LOCATIONS: TaxLocation[] = [
  { code: "MANUAL", label: "Manual estimate", rate: 5 },
  { code: "AL", label: "Alabama", rate: 5 },
  { code: "AK", label: "Alaska", rate: 0 },
  { code: "AZ", label: "Arizona", rate: 2.5 },
  { code: "AR", label: "Arkansas", rate: 3.9 },
  { code: "CA", label: "California", rate: 12.3 },
  { code: "CO", label: "Colorado", rate: 4.4 },
  { code: "CT", label: "Connecticut", rate: 6.99 },
  { code: "DE", label: "Delaware", rate: 6.6 },
  { code: "DC", label: "District of Columbia", rate: 10.75 },
  { code: "FL", label: "Florida", rate: 0 },
  { code: "GA", label: "Georgia", rate: 5.19 },
  { code: "HI", label: "Hawaii", rate: 11 },
  { code: "ID", label: "Idaho", rate: 5.3 },
  { code: "IL", label: "Illinois", rate: 4.95 },
  { code: "IN", label: "Indiana", rate: 3 },
  { code: "IA", label: "Iowa", rate: 3.8 },
  { code: "KS", label: "Kansas", rate: 5.2 },
  { code: "KY", label: "Kentucky", rate: 4 },
  { code: "LA", label: "Louisiana", rate: 3 },
  { code: "ME", label: "Maine", rate: 7.15 },
  { code: "MD", label: "Maryland", rate: 5.75 },
  { code: "MA", label: "Massachusetts", rate: 5 },
  { code: "MI", label: "Michigan", rate: 4.25 },
  { code: "MN", label: "Minnesota", rate: 9.85 },
  { code: "MS", label: "Mississippi", rate: 4.4 },
  { code: "MO", label: "Missouri", rate: 4.7 },
  { code: "MT", label: "Montana", rate: 5.9 },
  { code: "NE", label: "Nebraska", rate: 5.2 },
  { code: "NV", label: "Nevada", rate: 0 },
  { code: "NH", label: "New Hampshire", rate: 0 },
  { code: "NJ", label: "New Jersey", rate: 10.75 },
  { code: "NM", label: "New Mexico", rate: 5.9 },
  { code: "NY", label: "New York", rate: 10.9 },
  { code: "NC", label: "North Carolina", rate: 3.99 },
  { code: "ND", label: "North Dakota", rate: 2.5 },
  { code: "OH", label: "Ohio", rate: 3.125 },
  { code: "OK", label: "Oklahoma", rate: 4.5 },
  { code: "OR", label: "Oregon", rate: 9.9 },
  { code: "PA", label: "Pennsylvania", rate: 3.07 },
  { code: "RI", label: "Rhode Island", rate: 5.99 },
  { code: "SC", label: "South Carolina", rate: 6.2 },
  { code: "SD", label: "South Dakota", rate: 0 },
  { code: "TN", label: "Tennessee", rate: 0 },
  { code: "TX", label: "Texas", rate: 0 },
  { code: "UT", label: "Utah", rate: 4.55 },
  { code: "VT", label: "Vermont", rate: 8.75 },
  { code: "VA", label: "Virginia", rate: 5.75 },
  { code: "WA", label: "Washington", rate: 0 },
  { code: "WV", label: "West Virginia", rate: 4.82 },
  { code: "WI", label: "Wisconsin", rate: 7.65 },
  { code: "WY", label: "Wyoming", rate: 0 },
  { code: "AS", label: "American Samoa", rate: 27, note: "Territory estimate" },
  { code: "GU", label: "Guam", rate: 0, note: "Mirror-code territory; use federal/manual rows" },
  { code: "MP", label: "Northern Mariana Islands", rate: 0, note: "Mirror-code territory; use federal/manual rows" },
  { code: "PR", label: "Puerto Rico", rate: 33, note: "Territory estimate" },
  { code: "VI", label: "U.S. Virgin Islands", rate: 0, note: "Mirror-code territory; use federal/manual rows" },
];

export const DEFAULT_TAX_LOCATION: TaxLocationCode = "MANUAL";

export function getTaxLocation(code: string | null | undefined) {
  return TAX_LOCATIONS.find((location) => location.code === code) || TAX_LOCATIONS[0];
}
