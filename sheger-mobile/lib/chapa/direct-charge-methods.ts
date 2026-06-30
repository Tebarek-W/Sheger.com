export type ChapaDirectChargeType = "telebirr" | "cbebirr" | "mpesa" | "ebirr";

export type ChapaDirectChargeMethod = {
  id: ChapaDirectChargeType;
  labelKey:
    | "payment.chapaMethods.telebirr"
    | "payment.chapaMethods.cbebirr"
    | "payment.chapaMethods.mpesa"
    | "payment.chapaMethods.ebirr";
  descKey:
    | "payment.chapaMethods.telebirrDesc"
    | "payment.chapaMethods.cbebirrDesc"
    | "payment.chapaMethods.mpesaDesc"
    | "payment.chapaMethods.ebirrDesc";
  icon: string;
  color: string;
};

export const CHAPA_DIRECT_CHARGE_METHODS: ChapaDirectChargeMethod[] = [
  {
    id: "telebirr",
    labelKey: "payment.chapaMethods.telebirr",
    descKey: "payment.chapaMethods.telebirrDesc",
    icon: "📱",
    color: "#e8f5e9",
  },
  {
    id: "cbebirr",
    labelKey: "payment.chapaMethods.cbebirr",
    descKey: "payment.chapaMethods.cbebirrDesc",
    icon: "🏦",
    color: "#e3f2fd",
  },
  {
    id: "mpesa",
    labelKey: "payment.chapaMethods.mpesa",
    descKey: "payment.chapaMethods.mpesaDesc",
    icon: "💚",
    color: "#f1f8e9",
  },
  {
    id: "ebirr",
    labelKey: "payment.chapaMethods.ebirr",
    descKey: "payment.chapaMethods.ebirrDesc",
    icon: "💳",
    color: "#fce4ec",
  },
];

export function isChapaDirectChargeType(value: string): value is ChapaDirectChargeType {
  return CHAPA_DIRECT_CHARGE_METHODS.some((method) => method.id === value);
}

export function getChapaDirectChargeMethod(
  chargeType: string,
): ChapaDirectChargeMethod | undefined {
  return CHAPA_DIRECT_CHARGE_METHODS.find((method) => method.id === chargeType);
}
