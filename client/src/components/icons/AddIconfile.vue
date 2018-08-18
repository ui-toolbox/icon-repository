<template>
    <div>
        <select-file-to-upload
            v-if="!isFileSelected"
            class="upload-box"
            :uploadFieldName="'iconFile'"
            @change='changes => filesChange(changes)'/>
        <div
            v-if="isFileSelected">
            <el-row>
                <el-col :span="24">
                    <iconfile-attributes
                        :formats='formats'
                        :sizes='sizes'
                        :attributes="{fileName, format, size}"
                        @change='onAttributeChange'/>
                </el-col>
            </el-row>
            <el-row style="margin-top: -20px">
                <el-col :span="24" :offset="18">
                    <el-button type="primary" icon="el-icon-circle-plus-outline" @click="addIconfile">Add icon-file</el-button>
                </el-col>
            </el-row>
        </div>
    </div>
</template>

<script>
import Vue from 'vue';
import IconfileAttributes from '@/components/icons/IconfileAttributes';
import SelectFileToUpload from '@/components/icons/SelectFileToUpload';
import { addIconfile } from '@/services/icon';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';

export default {
    components: {
        'iconfile-attributes': IconfileAttributes,
        'select-file-to-upload': SelectFileToUpload
    },
    props: [
        "formats",
        "sizes",
        "iconName"
    ],
    computed: {
        isFileSelected() {
            return this.fileName ? this.fileName.length > 0 : false;
        }
    },
    data() {
        return {
            fileName: null,
            format: this.initialFormat(),
            size: this.initialSize(),
            formData: null
        };
    },
    methods: {
        resetData() {
            this.fileName = null;
            this.format = this.initialFormat();
            this.size = this.initialSize();
            this.formData = null
        },
        initialFormat() {
            return Vue.util.extend({}, this.formats)[0];
        },
        initialSize() {
            return Vue.util.extend({}, this.sizes)[0];
        },
        filesChange({iconfileName, formData}) {
            this.fileName = iconfileName;
            this.formData = formData;
        },
        onAttributeChange(newAttrib) {
            this.fileName = newAttrib.fileName || this.fileName;
            this.format = newAttrib.format || this.format;
            this.size = newAttrib.size || this.size;
        },
        addIconfile() {
            addIconfile(this.iconName, this.format, this.size, this.formData)
            .then(
                () => {
                    this.resetData();
                    this.$showSuccessMessage("Icon-file added");
                    this.$emit('iconfileAdded');
                },
                error => this.$showErrorMessage(error)
            )
            .catch(error => this.$showErrorMessage(error));
        }
    }
}
</script>
