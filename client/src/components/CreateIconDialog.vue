<template>
<div>
    <el-dialog title="New icon" :visible="dialogVisible" width="30%" :before-close="handleClose">
        <select-file-to-upload
                class="upload-box"
                v-if="!isFileSelected"
                :uploadFieldName="'iconFile'"
                @change='changes => filesChange(changes)'/>
        <icon-file-attributes
                v-if="isFileSelected"
                :formats='formats'
                :sizes='sizes'
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
import IconFileAttributes from '@/components/IconFileAttributes';
import SelectFileToUpload from '@/components/SelectFileToUpload';
import { createIcon } from '@/services/icon';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';

export default {
    props: [
        "formats",
        "sizes",
        "dialogVisible"
    ],
    components: {
        'icon-file-attributes': IconFileAttributes,
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
            format: this.initialFormat(),
            size: this.initialSize(),
            formData: null,
            inUpload: false
        };
    },
    watch: { // "props" seem to be really "scope.props" in Vue:
        formats: function() {
            this.format = this.initialFormat();
        },
        sizes: function(newSizes) {
            this.size = this.initialSize();
        }
    },
    methods: {
        resetData() {
            this.iconName = '';
            this.fileName = '';
            this.format = this.initialFormat();
            this.size = this.initialSize();
            this.formData = null;
        },
        initialFormat() {
            return Vue.util.extend({}, this.formats)[0];
        },
        initialSize() {
            return Vue.util.extend({}, this.sizes)[0];
        },
        onAttributeChange(newAttributes) {
            this.iconName = newAttributes.iconName;
            this.format = newAttributes.format;
            this.size = newAttributes.size;
        },
        filesChange({fieldName, fileList}) {
            // handle file changes
            this.fileName = fileList[0].name;
            this.iconName = this.fileName;

            const formData = new FormData();

            if (!fileList.length) return;

            // append the files to FormData
            Array
            .from(Array(fileList.length).keys())
            .map(x => {
                formData.append(fieldName, fileList[x], fileList[x].name);
            });
            this.formData = formData;
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
                () => this.hideDialog(SUCCESSFUL),
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
            this.$confirm('Are you sure to close this dialog?')
            .then(_ => {
                this.hideDialog(CANCELLED);
            })
            .catch(_ => {});
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