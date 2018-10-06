<template>
    <el-dialog :visible="dialogVisible" :before-close="close" width="40%">
        <span class="title-bar" slot="title">
            <i v-if="editable && inEdit" class="el-icon-view title-control view-icon-button" :class="{hidden: !inEdit}" @click="viewIcon"/>
            <i v-if="editable && !inEdit" class="el-icon-edit title-control edit-icon-button" :class="{hidden: inEdit}" @click="editIcon"/>
            <i v-if="editable" class="el-icon-delete title-control delete-icon-button" @click="deleteIcon"/>
        </span>
        <el-row class="icon-box-row">
            <el-col :span="24">
                <div>
                    <iconfile-portal
                        class="icon-preview-image"
                        :iconName="name"
                        :imageUrl="pathOfSelectedIconfile"
                        @iconfile-uploaded="onIconfileUploaded"/>
                    <div class="icon-name">{{icon.name}}</div>
                </div>
            </el-col>
        </el-row>
        <el-row class="properties-row">
            <el-row>
                <el-col :span="24">
                    <labeled-tag-collection
                        :label="'Modified by'"
                        :tags="collaborators"
                        :editable="false"/>
                </el-col>
            </el-row>
            <el-row>
                <el-col :span="24">
                    <labeled-tag-collection
                        :label="'Available formats'"
                        :tags="iconfileFormats"
                        :selectedIndex="selectedIconfileIndex"
                        :itemsCanBeAdded="false"
                        :itemsCanBeRemoved="inEdit"
                        @change-selection="changeSelectedIconfileRequest"
                        @remove-tag="iconfileDeletionRequest"/>
                </el-col>
            </el-row>
            <el-row>
                <el-col :span="24">
                    <labeled-tag-collection
                        :label="'Tags'"
                        :tags="['<Coming soon...>']"
                        :editable="false"/>
                </el-col>
            </el-row>
        </el-row>
        <el-row class="button-row">
            <el-col :span="4" :offset="10"><a :href="pathOfSelectedIconfile" :download="downloadName"><el-button>Download</el-button></a></el-col>
        </el-row>
    </el-dialog>
</template>

<script>
import getUrl from '@/services/url';
import * as userService from '@/services/user';
import { deleteIconfile, deleteIcon } from '@/services/icon';
import LabeledTagCollection from '@/components/LabeledTagCollection';
import IconfilePortal from '@/components/icons/IconfilePortal';
import { createIconfileList, preferredIconfileType, indexInIconfileListOfType } from '@/services/icon';
import { SUCCESSFUL, CANCELLED } from '@/services/constants';
import SelectFileToUpload from '@/components/icons/SelectFileToUpload';

export default {
    props: [
        "icon",
        "editable",
        "initInEdit",
        "dialogVisible"
    ],
    components: {
        'labeled-tag-collection': LabeledTagCollection,
        'iconfile-portal': IconfilePortal,
    },
    data() {
        return {
            name: this.icon.name,
            modifiedBy: this.icon.modifiedBy,
            fileList: createIconfileList(this.icon.paths),
            selectedIconfileIndex: this.initialIconfileSelection(),
            previouslySelectedIconFile: -1,
            inEdit: this.initInEdit
        }
    },
    computed: {
        collaborators() {
            return (typeof this.modifiedBy === 'string' && this.modifiedBy.length > 0)
                ? [this.modifiedBy]
                : [];
        },
        iconfileFormats() {
            return this.fileList.map(iconfile => `${iconfile.format}@${iconfile.size}`);
        },
        pathOfSelectedIconfile() {
            return this.selectedIconfileIndex >= 0
                ? this.fileList[this.selectedIconfileIndex].url
                : undefined;
        },
        downloadName() {
            const iconfile = this.fileList[this.selectedIconfileIndex];
            return `${this.name}@${iconfile.size}.${iconfile.format}`;
        }
    },
    methods: {
        initialIconfileSelection() {
            const icon = this.icon;
            const preferredType = preferredIconfileType(icon);
            return indexInIconfileListOfType(createIconfileList(icon.paths), preferredType);
        },
        changeSelectedIconfileRequest(index) {
            this.selectedIconfileIndex = index;
        },
        getSelectedFormat() {
            return this.iconfileFormats[this.selectedIconfileIndex];
        },
        viewIcon() {
            this.selectedIconfileIndex = this.previouslySelectedIconFile;
            this.inEdit = false;
        },
        editIcon() {
            this.inEdit = true;
            this.previouslySelectedIconFile = this.selectedIconfileIndex;
            this.selectedIconfileIndex = -1;
        },
        tagAdditionRequest(tagValue) {
            this.iconTags.push(tagValue);
        },
        tagRemovalRequest(tag) {
            this.iconTags.splice(this.iconTags.indexOf(tag), 1);
        },
        onIconfileUploaded(iconfileMetadata) {
            this.name = iconfileMetadata.iconName;
            this.fileList.push({...iconfileMetadata, url: getUrl(iconfileMetadata.path)});
            this.selectedIconfileIndex = indexInIconfileListOfType(this.fileList, iconfileMetadata);
            this.modifiedBy = userService.getUserInfo().username;
            this.inEdit = false;
            this.$showSuccessMessage(`Iconfile ${this.getSelectedFormat()} added`);
        },
        iconfileDeletionRequest(index) {
            const selectedFormat = this.iconfileFormats[index];
            deleteIconfile(this.fileList[index].path)
            .then(
                () => {
                    this.fileList = this.fileList.filter((file, i) => i !== index);
                    this.selectedIconfileIndex = 0;
                    this.modifiedBy = userService.getUserInfo().username;
                    this.inEdit = false;
                    this.$showSuccessMessage(`Iconfile ${selectedFormat} removed`);
                },
                error => this.$showErrorMessage(error)
            )
            .catch(error => this.$showErrorMessage(error));
        },
        deleteIcon() {
            deleteIcon(this.name)
            .then(
                () => {
                    this.fileList = null;
                    this.$showSuccessMessage(`Icon ${this.name} removed`);
                    this.hideDialog();
                },
                error => this.$showErrorMessage(error)
            )
            .catch(error => this.$showErrorMessage(error));
        },
        close() {
            this.hideDialog();
        },
        hideDialog() {
            this.$emit("finished", {
                icon: {
                    name: this.name,
                    modifiedBy: this.modifiedBy,
                    paths: this.fileList
                },
                status: SUCCESSFUL
            });
        }
    }
}
</script>

<style lang='scss' scoped>
    .el-dialog__body {
        padding: 10px 20px 30px;
    }
    .el-row {
        margin-bottom: 10px;
    }
    .el-row.icon-box-row, .properties-row {
        margin-bottom: 40px;
    }
    .el-row:last-child {
        margin-bottom: 0;
    }

    .title-bar {
        display: block;
        position: relative;
        .title-control {
            top: 0px;
            position: absolute;
            cursor: pointer;
            transition: opacity 0.3s ease-in-out;
        }
        .title-control.hidden {
            opacity: 0;
            cursor: default;
        }
        .view-icon-button {
            right: 48px;
        }
        .edit-icon-button {
            right: 48px;
        }
        .delete-icon-button {
            right: 24px;
        }
    }
    .icon-preview-image {
        display: block;
    }
    .icon-name {
        display: block;
        margin-top: 20px;
        font-size: 24px;
        text-align: center;
    }
    .properties-row {
        padding: 0 20px;
    }
    .download_button {
        min-height: 36px;
        margin: 10px 0 30px;
    }
    .bg-purple-dark {
        background: #99a9bf;
    }
</style>
