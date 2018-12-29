import { List } from "immutable";
import * as React from "react";
import { Tag, ITagProps } from "@blueprintjs/core";

import "./tag-collection.scss";

export interface TagCollectionProps {
    readonly tags: List<string>;
    readonly selectedIndex: number;
    readonly selectionChangeRequest?: (index: number) => void;
    readonly tagAdditionRequest?: (tagText: string) => void;
    readonly tagRemovalRequest?: (index: number) => void;
}

export interface TagCollectionState {
    inputVisible: boolean;
    inputValue: string;
}

export class TagCollection extends React.Component<TagCollectionProps, TagCollectionState> {

    constructor(props: TagCollectionProps) {
        super(props);
        this.state = {
            inputVisible: false,
            inputValue: ""
        };
    }

    public render() {
        return <div className="tag-collection">
            {this.props.tags.toArray().map((t, key) => this.createTag(t, key, this.props.selectedIndex === key))}
        </div>;
    }

    private createTag(tagText: string, index: number, selected: boolean) {
        return <Tag minimal={true}
                   round={true}
                   key={index}
                   onClick={() => this.handleOnClick(index)}
                   onRemove={this.createOnRemoveHandler(index)}
                   data-selected={selected}>
                <span>{tagText}</span>
            </Tag>;
    }

    private createOnRemoveHandler(index: number) {
        return this.props.tagRemovalRequest
            ? (e: React.MouseEvent<HTMLButtonElement>, tagProps: ITagProps) => this.props.tagRemovalRequest(index)
            : undefined;
    }

    private handleOnClick(index: number) {
        if (this.props.selectionChangeRequest) {
            this.props.selectionChangeRequest(index);
        }
    }
}
