export interface UploadedFile {
  type: 'openapi' | 'csv' | 'plaintext';
  content: any;
  name: string;
}

export interface OpenAPISpec {
  openapi?: string;
  info?: any;
  paths?: any;
  components?: any;
}
