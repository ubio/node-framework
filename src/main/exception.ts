export interface ExceptionSpec {
    name: string;
    code?: string;
    message?: string;
    status?: number;
    retry?: boolean;
    details?: object;
}

export class Exception extends Error {
    code: string;
    status?: number;
    retry?: boolean;
    details?: any;

    constructor(spec: ExceptionSpec) {
        super(spec.message);
        this.name = spec.name;
        this.code = spec.code || spec.name;
        this.message = spec.message || spec.name;
        if (spec.status != null) {
            this.status = spec.status;
        }
        if (spec.retry != null) {
            this.retry = spec.retry;
        }
        this.details = spec.details;
    }

}
