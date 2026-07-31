export type JsonObject = Record<string, unknown>;

export interface MeterInfo extends JsonObject {
  ID: string;
  MeterNo: string;
  MeterSeat: string;
  MeterAddr?: string;
  Name?: string;
  isCheck?: boolean;
}

export interface MeterOtherInfo extends JsonObject {
  ID: string;
  BarCode: string;
  LeadSealFirst: string;
  LeadSealSecond: string;
  MeterSeat: number;
}

export interface WisdomRoot extends JsonObject {
  MeterInfoList: MeterInfo[];
  CertificateCode: Record<string, string>;
  LastNum: number;
  Scheme: JsonObject;
  SchemeGroupList: JsonObject[];
  ResultDetailList: JsonObject[];
  TestItemList: JsonObject[];
  MeterOtherInfoMap: Record<string, MeterOtherInfo>;
  Inspector: string;
  Verifier: string;
  ID: string;
}
