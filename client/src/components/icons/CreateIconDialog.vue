<template>
<div>
    <el-dialog title="New icon" :visible="dialogVisible" width="30%" :before-close="handleClose">
        <select-file-to-upload
                class="upload-box"
                v-if="!isFileSelected"
                :uploadFieldName="'iconFile'"
                @change='changes => filesChange(changes)'/>
        <create-icon-attributes
                v-if="isFileSelected"
                :iconfileTypes="iconfileTypes"
                :attributes="{iconName, fileName, format, size}"
                @change='onAttributeChange'/>
        <span slot="footer" class="dialog-footer">
            <el-button @click="cancel">Cancel</el-button>
            <el-button type="primary" :disabled="fileName.length === 0" @click="upload">Upload</el-button>
        </span>
    </el-dialog>
</div>
</template>

<script>
import Vue from 'vue';
import { defaultTypeForFile } from '@/services/config';
import CreateIconAttributes from '@/components/icons/CreateIconAttributes';
import SelectFileToUpload from '@/components/icons/SelectFileToUpload';
import { createIcon } from '@/services/icon';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';

export default {
    props: [
        "iconfileTypes",
        "dialogVisible"
    ],
    components: {
        'create-icon-attributes': CreateIconAttributes,
        'select-file-to-upload': SelectFileToUpload
    },
    computed: {
        isFileSelected() {
            return this.fileName.length > 0;
        }
    },
    data() {
        return {
            iconName: '',
            fileName: '',
            format: null,
            size: null,
            formData: null,
            inUpload: false
        };
    },
    methods: {
        resetData() {
            this.iconName = '';
            this.fileName = '';
            this.format = null;
            this.size = null;
            this.formData = null;
        },
        onAttributeChange(newAttrib) {
            this.iconName = newAttrib.iconName || this.iconName;
            this.format = newAttrib.format || this.format;
            this.size = newAttrib.size || this.size;
        },
        filesChange({iconfileName, formData}) {
            this.fileName = iconfileName;
            this.iconName = iconfileName;
            this.formData = formData;
            const iconfileType = defaultTypeForFile(this.fileName);
            this.format = iconfileType.format;
            this.size = iconfileType.size;
        },
        cancel() {
            this.hideDialog(CANCELLED);
        },
        upload() {
            this.formData.append("name", this.iconName);
            this.formData.append("format", this.format);
            this.formData.append("size", this.size);

            createIcon(this.formData)
            .then(
                () => {
                    this.hideDialog(SUCCESSFUL);
                    this.$showSuccessMessage("Icon added");
                },
                error => {
                    console.log("Upload failed", error.message);
                    this.hideDialog(FAILED, error);
                }
            )
            .catch(error => {
                console.log("Upload failed", error);
                this.hideDialog(FAILED, error);
            });
        },
        handleClose(done) {
            if (this.isFileSelected) {
                this.$confirm('Are you sure to close this dialog?')
                .then(_ => {
                    this.hideDialog(CANCELLED);
                })
                .catch(_ => {});
            } else {
                this.hideDialog(CANCELLED);
            }
        },
        hideDialog(status, error) {
            this.resetData()
            this.$emit("finished", {
                status,
                error
            });
        }
    }
};
</script>

<style lang="scss">
.upload-box {
    margin-bottom: 20px;
}
</style>