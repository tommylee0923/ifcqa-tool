export type IfcqaGidDetail = {
    gid: string | null;
};

export type IfcqaHoverEvent = CustomEvent<IfcqaGidDetail>;
export type IfcqaSelectEvent = CustomEvent<IfcqaGidDetail>;