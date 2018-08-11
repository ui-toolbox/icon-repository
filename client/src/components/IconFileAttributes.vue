<template>
    <div>
        <el-row class="attribute-label">
        <el-col :span="5"><span>Icon name: </span></el-col>
        </el-row>
        <el-row>
        <el-col class="text-value" :span="24">
            <el-input placeholder="Please specify the icon name" v-model="iconName"/>
        </el-col>
        </el-row>

        <el-row class="attribute-label">
        <el-col :span="5"><span>File name: </span></el-col>
        </el-row>
        <el-row>
        <el-col class="text-value" :span="24">
            <el-input disabled v-model="fileName"></el-input>
        </el-col>
        </el-row>

        <el-row class="attribute-label">
        <el-col :span="5"><span>Icon file format: </span></el-col>
        </el-row>
        <el-row>
        <el-col :span="12">
            <el-select placeholder="Select icon file format"
                    v-model="format"
                    @change="value => onAttributeChange({format: value})">
                <el-option v-for="item in formatOptions" :key="item.value" :label="item.label" :value="item.value"></el-option>
            </el-select>
        </el-col>
        </el-row>    

        <el-row class="attribute-label">
        <el-col :span="5"><span>Icon size: </span></el-col>
        </el-row>
        <el-row>
        <el-col :span="12">
            <el-select placeholder="Select icon size"
                    v-model="size"
                    @change="value => onAttributeChange({size: value})">
                <el-option v-for="item in sizeOptions" :key="item.event" :label="item.label" :value="item.value"></el-option>
            </el-select>
        </el-col>
        </el-row>
    </div>
</template>

<script>
export default {
    name: 'IconFileAttributes',
    props: [
        "formats",
        "sizes",
        "attributes"
    ],
    watch: {
        iconName(newValue) {
            this.onAttributeChange({iconName: newValue});
        }
    },
    computed: {
        formatOptions() {
            return this.formats.map(f => ({value: f, label: f}));
        },
        sizeOptions() {
            return this.sizes.map(f => ({value: f, label: f}));
        }
    },
    data: function() {
        return {
            iconName: this.attributes.fileName,
            fileName: this.attributes.fileName,
            format: this.attributes.format,
            size: this.attributes.size
        };
    },
    methods: {
        onAttributeChange(delta) {
            this.$emit('change', Object.assign(this.$data, delta))  ;
        }
    }
}
</script>

<style lang="scss">
    .el-row {
        margin-bottom: 10px;
    }
    .el-row.attribute-label {
        margin-left: 4px;
        margin-bottom: 1px;
    }
</style>
