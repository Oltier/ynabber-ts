import { DateTime, UUID } from "../../utils/utility-types";

export type RequisitionStatus =
  | "CR" // Created - Requisition has been successfully created
  | "GC" // Giving consent - End-user is giving consent at GoCardless's consent screen
  | "UA" // Undergoing Authentication - End-user is redirected to the financial institution for authentication
  | "RJ" // Rejected - Either SSN verification has failed or end-user has entered incorrect credentials
  | "SA" // Selecting accounts - End-user is selecting accounts
  | "GA" // Granting access - End-user is granting access to their account information
  | "LN" // Linked - Account has been successfully linked to requisition
  | "EX" // Expired - Access to accounts has expired as set in End User Agreement
  | "ID"
  | "ER"
  | "SU";

export type Requisition = {
  id: UUID;
  created: DateTime;
  redirect?: string;
  status: RequisitionStatus;
  institution_id: string;
  agreement: UUID;
  accounts: UUID[];
  user_language: string;
  link: string;
  ssn?: string;
  account_selection?: boolean;
  redirect_immediate?: boolean;
};
